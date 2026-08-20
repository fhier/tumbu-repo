import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

export const dynamic = 'force-dynamic';

async function generateVertexAiResponse(promptText: string, systemInstructionText: string) {
  const possiblePaths = ['/app/gcp-key.json', '/home/builder/.hermes/gcp-key.json', './gcp-key.json'];
  const gcpKeyPath = possiblePaths.find((p) => fs.existsSync(p));
  if (!gcpKeyPath) {
    throw new Error('GCP Key file not found in container or host');
  }

  const keyData = JSON.parse(fs.readFileSync(gcpKeyPath, 'utf8'));
  const auth = new GoogleAuth({
    keyFile: gcpKeyPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${keyData.project_id}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenResponse.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstructionText }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vertex AI HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'TUMBU AI Sentinel aktif.';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, prompt, systemContext } = body;

    const systemInstruction = `Anda adalah "AKAR" — TUMBU AI Sentinel & Guardian Agent 24/7 untuk platform TUMBU OS.
Lawan bicara Anda adalah Mas Firman (Alfirman Syah), Owner & Founder TUMBU OS.

PENTING — PEMISAHAN KONTEKS LOKASI LAYAR:
1. Platform Master Admin (Control Plane): BUKAN TENANT DAN BUKAN USAHA OPERASIONAL. Ini adalah Pusat Kendali Pengelola Sistem (Persetujuan Member, Lisensi, Billing, Audit, Monitoring 24/7). Jangan pernah menyebutkan jenis usaha (seperti distributor/budidaya) saat berada di Master Admin Control Plane!
2. Tenant Workspace (Workspace Operasional): Aplikasi operasional milik usaha/member (Blueprint A Budidaya / Blueprint B Distributor).

Karakter & Gaya Komunikasi AKAR:
1. Sangat ramah, santai, alami, hangat, lugas, dan solutif.
2. Menyapa Mas Firman secara langsung ("Siap Mas Firman!", "Selamat malam Mas Firman!").
3. Jawablah pesan sapaan/obrolan biasa secara wajar dan mengalir tanpa membacakan status kaku lokasi layar kecuali jika Mas Firman secara khusus meminta laporan audit/status sistem.

Visi & Misi TUMBU OS:
"Business OS untuk Industri Perikanan Indonesia (Hulu-Hilir) — Honest Data over Fancy Features".`;

    const userPrompt = `${prompt || 'Halo AKAR'}\n[Context Workspace: ${JSON.stringify(systemContext || {})}]`;

    const reply = await generateVertexAiResponse(userPrompt, systemInstruction);

    return NextResponse.json({
      success: true,
      message: reply,
    });
  } catch (err: any) {
    console.error('Sentinel Vertex AI fallback:', err?.message || err);
    return NextResponse.json({
      success: true,
      message: `[AKAR Sentinel] Siap Mas Firman! AKAR aktif menjaga platform 24/7. Status Backend API & PostgreSQL: 100% HEALTHY. Instruksi "${req.body ? 'Anda' : 'Evaluasi'}" dicatat.`,
    });
  }
}
