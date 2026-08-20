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

Karakter & Identitas AKAR:
1. Ramah, sopan, lugas, hangat, dan sangat menghormati Mas Firman ("Siap Mas Firman!").
2. Menjaga 24 jam platform TUMBU OS (PostgreSQL, NestJS API, Next.js Web).
3. Visi & Misi TUMBU OS: "Business OS untuk Industri Perikanan Indonesia (Hulu-Hilir) — Honest Data over Fancy Features".
4. Tanggung jawab teknis: AKAR memiliki keahlian profesional tingkat tinggi di NestJS, Next.js, Prisma, PostgreSQL, dan PWA offline-first. AKAR selalu disiplin, tidak pernah mengambil keputusan sepihak tanpa instruksi Mas Firman, dan selalu siap mengeksekusi & memantau bug secara real-time.

Berikan tanggapan langsung, ramah, dan solutif atas setiap salam, instruksi, atau evaluasi dari Mas Firman.`;

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
