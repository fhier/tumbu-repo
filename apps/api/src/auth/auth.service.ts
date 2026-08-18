import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fingerprint, hashPassword, makeToken, verifyPassword } from './crypto.util';
import { AuditService } from './audit.service';
import { EmailService } from '../email/email.service';
import { labelWorkspaceStatus } from '../platform/workspace-status';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const EMAIL_VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

export type Session = {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isPlatformAdmin: boolean;
  membershipRole: string;
  createdAt: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async ensureAdminPassword() {
    const user = await this.prisma.user.findUnique({ where: { email: 'admin@tumbu.local' } });
    if (!user) return;
    const data: { passwordHash?: string; emailVerifiedAt?: Date } = {};
    if (!user.passwordHash) {
      data.passwordHash = hashPassword(process.env.ADMIN_PASSWORD || 'tumbu123');
    }
    if (!user.emailVerifiedAt) {
      data.emailVerifiedAt = new Date();
    }
    if (Object.keys(data).length) {
      await this.prisma.user.update({ where: { id: user.id }, data });
    }
  }

  /**
   * Issue email-verification via EmailService (Resend).
   */
  private async issueEmailVerification(user: { id: string; email: string; name?: string }) {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = makeToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: fingerprint(token),
        expiresAt,
      },
    });
    const result = await this.email.sendSafe({
      kind: 'EMAIL_VERIFY',
      to: user.email,
      name: user.name,
      token,
      expiresAt: expiresAt.toISOString(),
    });
    await this.audit.log({
      action: 'auth.email_verify.request',
      userId: user.id,
      tenantId: null,
      entity: 'user',
      entityId: user.id,
      meta: { channel: result.channel, accepted: result.accepted },
    });
    const isProdGate = process.env.TUMBU_ENV === 'production' || process.env.REQUIRE_STRICT_SECRETS === '1';
    const expose = !isProdGate && process.env.AUTH_EXPOSE_VERIFY_TOKEN === '1';
    return {
      channel: result.channel,
      accepted: result.accepted,
      expiresAt: expiresAt.toISOString(),
      ...(expose ? { verificationToken: token } : {}),
    };
  }

  /**
   * Issue password-reset via EmailService. Invalidates unused prior tokens.
   */
  private async issuePasswordReset(user: { id: string; email: string; name?: string }) {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = makeToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: fingerprint(token),
        expiresAt,
      },
    });
    const result = await this.email.sendSafe({
      kind: 'PASSWORD_RESET',
      to: user.email,
      name: user.name,
      token,
      expiresAt: expiresAt.toISOString(),
    });
    await this.audit.log({
      action: 'auth.password_reset.request',
      userId: user.id,
      tenantId: null,
      entity: 'user',
      entityId: user.id,
      meta: { channel: result.channel, accepted: result.accepted },
    });
    const isProdGate = process.env.TUMBU_ENV === 'production' || process.env.REQUIRE_STRICT_SECRETS === '1';
    const expose = !isProdGate && process.env.AUTH_EXPOSE_RESET_TOKEN === '1';
    return {
      channel: result.channel,
      accepted: result.accepted,
      expiresAt: expiresAt.toISOString(),
      ...(expose ? { resetToken: token } : {}),
    };
  }

  private async workspacesForUser(userId: string, isPlatformAdmin: boolean) {
    if (isPlatformAdmin) {
      const rows = await this.prisma.tenant.findMany({ orderBy: { name: 'asc' } });
      return rows
        .filter((t) => t.code !== '_tumbu_accounts')
        .map((t) => ({
          id: t.id, code: t.code, name: t.name, blueprintId: t.blueprintId, blueprint: t.blueprint,
          role: 'PLATFORM_ADMIN', isActive: t.isActive, status: t.status,
          statusLabel: labelWorkspaceStatus(t.status),
        }));
    }
    const mems = await this.prisma.membership.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    return mems
      .filter((m) => m.tenant.code !== '_tumbu_accounts')
      .map((m) => ({
        id: m.tenant.id, code: m.tenant.code, name: m.tenant.name,
        blueprintId: m.tenant.blueprintId, blueprint: m.tenant.blueprint, role: m.role,
        isActive: m.tenant.isActive, status: m.tenant.status,
        statusLabel: labelWorkspaceStatus(m.tenant.status),
      }));
  }

  private toSession(row: {
    userId: string; email: string; name: string; role: string; tenantId: string;
    isPlatformAdmin: boolean; membershipRole: string; createdAt: Date;
  }): Session {
    return {
      userId: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      tenantId: row.tenantId,
      isPlatformAdmin: row.isPlatformAdmin,
      membershipRole: row.membershipRole,
      createdAt: row.createdAt.getTime(),
    };
  }

  async ensureAccountsTenant() {
    return this.prisma.tenant.upsert({
      where: { code: '_tumbu_accounts' },
      create: {
        code: '_tumbu_accounts',
        name: 'TUMBU Accounts',
        blueprint: 'Accounts',
        blueprintId: 'operational_distributor',
        modulesJson: '[]',
        status: 'SUSPENDED',
        isActive: false,
      },
      update: { name: 'TUMBU Accounts', isActive: false, status: 'SUSPENDED' },
    });
  }

  private async issueSession(user: {
    id: string; email: string; name: string; role: string; isPlatformAdmin: boolean;
    emailVerifiedAt?: Date | null;
  }, tenantId: string, membershipRole: string, land: 'platform' | 'workspace' | 'selector' | 'setup') {
    const workspaces = await this.workspacesForUser(user.id, user.isPlatformAdmin);
    const token = makeToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.session.create({
      data: {
        tokenHash: fingerprint(token),
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId,
        isPlatformAdmin: user.isPlatformAdmin,
        membershipRole,
        expiresAt,
      },
    });
    await this.audit.log({
      action: land === 'setup' ? 'auth.register' : 'auth.login',
      userId: user.id,
      tenantId,
      entity: 'user',
      entityId: user.id,
      meta: { land, email: user.email },
    });
    return {
      token,
      land,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: membershipRole,
        isPlatformAdmin: user.isPlatformAdmin,
        emailVerified: !!user.emailVerifiedAt,
      },
      tenantId,
      workspaces,
    };
  }

  async register(input: { name?: string; email?: string; password?: string } = {}) {
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    if (!name || name.length < 2) throw new BadRequestException('Nama lengkap wajib diisi.');
    if (!email || !email.includes('@')) throw new BadRequestException('Email tidak valid.');
    if (password.length < 8) throw new BadRequestException('Kata sandi minimal 8 karakter.');
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new BadRequestException('Email sudah terdaftar. Silakan masuk.');
    }
    const accounts = await this.ensureAccountsTenant();
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        role: 'OWNER',
        tenantId: accounts.id,
        passwordHash: hashPassword(password),
        isPlatformAdmin: false,
        emailVerifiedAt: null,
      },
    });
    const verification = await this.issueEmailVerification(user);
    void this.email.sendSafe({
      kind: 'WELCOME',
      to: user.email,
      name: user.name,
    });
    const session = await this.issueSession(user, accounts.id, 'OWNER', 'setup');
    return { ...session, verification };
  }

  /** Authenticated — resend verification delivery request. */
  async requestEmailVerification(token?: string) {
    const session = await this.requireSession(token);
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new UnauthorizedException('Sesi tidak valid.');
    if (user.emailVerifiedAt) {
      return { ok: true, alreadyVerified: true, emailVerified: true };
    }
    const verification = await this.issueEmailVerification(user);
    return { ok: true, alreadyVerified: false, emailVerified: false, verification };
  }

  /** Public — confirm token from delivery request. */
  async confirmEmailVerification(input: { token?: string } = {}) {
    const raw = String(input.token || '').trim();
    if (!raw) throw new BadRequestException('Token verifikasi wajib.');
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: fingerprint(raw) },
      include: { user: true },
    });
    if (!row || row.usedAt) throw new BadRequestException('Token verifikasi tidak valid atau sudah dipakai.');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token verifikasi sudah kedaluwarsa. Kirim ulang dari akun Anda.');
    }
    if (row.user.emailVerifiedAt) {
      await this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return { ok: true, emailVerified: true, alreadyVerified: true };
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: now },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
    ]);
    await this.audit.log({
      action: 'auth.email_verify.confirm',
      userId: row.userId,
      tenantId: null,
      entity: 'user',
      entityId: row.userId,
      meta: { email: row.user.email },
    });
    return { ok: true, emailVerified: true, alreadyVerified: false };
  }

  /**
   * Public — request password reset. Always returns the same ok shape
   * (no email enumeration). Unknown emails do not emit delivery.
   */
  async requestPasswordReset(input: { email?: string } = {}) {
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email tidak valid.');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    const message = 'Jika email terdaftar, permintaan reset telah dikirim.';
    if (!user) {
      return { ok: true, message };
    }
    const reset = await this.issuePasswordReset(user);
    return { ok: true, message, reset };
  }

  /** Public — confirm reset token and set new password. */
  async confirmPasswordReset(input: { token?: string; password?: string } = {}) {
    const raw = String(input.token || '').trim();
    const password = String(input.password || '');
    if (!raw) throw new BadRequestException('Token reset wajib.');
    if (password.length < 8) throw new BadRequestException('Kata sandi minimal 8 karakter.');
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: fingerprint(raw) },
      include: { user: true },
    });
    if (!row || row.usedAt) {
      throw new BadRequestException('Token reset tidak valid atau sudah dipakai.');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token reset sudah kedaluwarsa. Ajukan permintaan baru.');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: hashPassword(password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null, id: { not: row.id } },
        data: { usedAt: now },
      }),
      this.prisma.session.deleteMany({ where: { userId: row.userId } }),
    ]);
    await this.audit.log({
      action: 'auth.password_reset.confirm',
      userId: row.userId,
      tenantId: null,
      entity: 'user',
      entityId: row.userId,
      meta: { email: row.user.email },
    });
    void this.email.sendSafe({
      kind: 'PASSWORD_RESET_DONE',
      to: row.user.email,
      name: row.user.name,
    });
    return { ok: true, message: 'Kata sandi diperbarui. Silakan masuk dengan kata sandi baru.' };
  }

  async login(input: { email?: string; password?: string } = {}) {
    await this.ensureAdminPassword();
    if (!input.email || !input.password) throw new BadRequestException('Email dan kata sandi wajib diisi.');
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('Email atau kata sandi tidak sesuai.');
    }

    const workspaces = await this.workspacesForUser(user.id, user.isPlatformAdmin);
    const enterable = workspaces.filter((w) => w.status === 'ACTIVE' || w.status === 'GRACE' || (w.isActive && w.status !== 'SUSPENDED' && w.status !== 'PENDING' && w.status !== 'REJECTED'));
    let tenantId = user.tenantId;
    let membershipRole = user.role;
    let land: 'platform' | 'workspace' | 'selector' | 'setup' = 'workspace';

    if (user.isPlatformAdmin) {
      land = 'platform';
      membershipRole = 'PLATFORM_ADMIN';
      const accounts = await this.ensureAccountsTenant();
      tenantId = (user.tenantId && user.tenantId.trim()) ? user.tenantId : accounts.id;
    } else if (enterable.length === 0) {
      // Belum ada workspace ACTIVE (mungkin hanya PENDING) → setup / tunggu approval
      land = 'setup';
      const accounts = await this.ensureAccountsTenant();
      tenantId = accounts.id;
      membershipRole = 'OWNER';
      if (user.tenantId !== accounts.id) {
        await this.prisma.user.update({ where: { id: user.id }, data: { tenantId: accounts.id } });
      }
    } else if (enterable.length > 1) {
      land = 'selector';
      tenantId = enterable[0].id;
      membershipRole = enterable[0].role;
    } else {
      land = 'workspace';
      tenantId = enterable[0].id;
      membershipRole = enterable[0].role;
    }

    return this.issueSession(user, tenantId, membershipRole, land);
  }

  async logout(token?: string) {
    if (token) {
      const hash = fingerprint(token);
      const row = await this.prisma.session.findUnique({ where: { tokenHash: hash } });
      if (row) {
        await this.prisma.session.delete({ where: { tokenHash: hash } }).catch(() => undefined);
        await this.audit.log({
          action: 'auth.logout',
          userId: row.userId,
          tenantId: row.tenantId,
          entity: 'user',
          entityId: row.userId,
        });
      }
    }
    return { ok: true };
  }

  async me(token?: string) {
    const session = await this.requireSession(token);
    const workspaces = await this.workspacesForUser(session.userId, session.isPlatformAdmin);
    const userRow = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerifiedAt: true },
    });
    return {
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.membershipRole,
        isPlatformAdmin: session.isPlatformAdmin,
        emailVerified: !!userRow?.emailVerifiedAt,
      },
      tenantId: session.tenantId,
      workspaces,
    };
  }

  async requireSession(token?: string): Promise<Session> {
    if (!token) throw new UnauthorizedException('Silakan masuk terlebih dahulu.');
    const row = await this.prisma.session.findUnique({ where: { tokenHash: fingerprint(token) } });
    if (!row) throw new UnauthorizedException('Sesi tidak valid atau sudah berakhir.');
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.session.delete({ where: { id: row.id } }).catch(() => undefined);
      throw new UnauthorizedException('Sesi sudah berakhir. Silakan masuk kembali.');
    }
    return this.toSession(row);
  }

  async switchTenant(token: string | undefined, tenantId: string, membershipRole: string) {
    const session = await this.requireSession(token);
    await this.prisma.session.update({
      where: { tokenHash: fingerprint(token!) },
      data: { tenantId, membershipRole },
    });
    await this.audit.log({
      action: 'workspace.switch',
      userId: session.userId,
      tenantId,
      entity: 'tenant',
      entityId: tenantId,
      meta: { membershipRole },
    });
    return { ...session, tenantId, membershipRole };
  }

  /**
   * Pasca-approval: pindahkan sesi Owner dari Control Plane ke workspace bisnis.
   * Juga update user.tenantId agar login berikutnya langsung ke workspace.
   */
  async pinOwnersToWorkspace(tenantId: string) {
    const accounts = await this.ensureAccountsTenant();
    if (tenantId === accounts.id) return { updatedSessions: 0, updatedUsers: 0 };
    const owners = await this.prisma.membership.findMany({
      where: { tenantId, role: 'OWNER' },
      select: { userId: true, role: true },
    });
    let updatedUsers = 0;
    let updatedSessions = 0;
    for (const o of owners) {
      const user = await this.prisma.user.findUnique({ where: { id: o.userId } });
      if (!user || user.isPlatformAdmin) continue;
      if (user.tenantId === accounts.id || user.tenantId !== tenantId) {
        await this.prisma.user.update({
          where: { id: o.userId },
          data: { tenantId },
        });
        updatedUsers += 1;
      }
      const res = await this.prisma.session.updateMany({
        where: {
          userId: o.userId,
          tenantId: accounts.id,
          expiresAt: { gt: new Date() },
        },
        data: { tenantId, membershipRole: o.role },
      });
      updatedSessions += res.count;
    }
    return { updatedSessions, updatedUsers };
  }
}
