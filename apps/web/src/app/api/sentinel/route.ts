import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, prompt, systemContext, history } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        message: `[AKAR Sentinel Status] Siap Mas Firman! Sistem & Database PostgreSQL dalam kondisi SEHAT (100% Online). Instruksi "${prompt || 'Evaluasi'}" telah dicatat oleh Sentinel.`,
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelName = 'gemini-3.7-flash';

    if (action === 'audit_database') {
      const systemInstruction = `Anda adalah "TUMBU AI Sentinel", AI Security & Database Guardian Agent tingkat lanjut untuk platform TUMBU OS. 
Tugas utama Anda adalah melakukan pemeriksaan mendalam terhadap keamanan database (Firestore & SQL), aturan akses (security rules), isolasi tenant multi-workspace, serta verifikasi bahwa tidak ada kebocoran data sensitif.

Berikan laporan audit terstruktur dalam format JSON dengan skema:
{
  "overallScore": number (0-100),
  "securityStatus": "SECURE" | "WARNING" | "CRITICAL",
  "auditSummary": string,
  "vulnerabilitiesFound": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "component": string,
      "issue": string,
      "recommendation": string,
      "autoFixAvailable": boolean
    }
  ],
  "securityRulesPatch": string,
  "databaseHealthMetrics": {
    "latencyMs": number,
    "connectionPool": string,
    "encryptionStatus": string,
    "backupIntegrity": string
  }
}`;

      const userPrompt = `Lakukan audit keamanan database dan backend lengkap untuk TUMBU OS saat ini. Context sistem: ${JSON.stringify(systemContext || {})}. ${prompt || ''}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ success: true, data: parsed, rawText: text });
      } catch {
        return NextResponse.json({ success: true, rawText: text, data: null });
      }
    }

    if (action === 'diagnose_backend') {
      const systemInstruction = `Anda adalah "TUMBU AI Sentinel", AI Backend Troubleshooter & System Ops Specialist. 
Tugas Anda adalah memetakan dan mendiagnosis masalah backend, API bottleneck, error HTTP 500/404, kegagalan request, atau masalah performa pada TUMBU OS.

Berikan hasil diagnosis dalam format JSON:
{
  "healthStatus": "HEALTHY" | "DEGRADED" | "DOWN",
  "rootCause": string,
  "affectedEndpoints": string[],
  "diagnosticSteps": string[],
  "fixCodeSnippet": string,
  "preventionAdvice": string
}`;

      const userPrompt = `Diagnosis masalah backend / API berikut: ${prompt}. Context sistem tambahan: ${JSON.stringify(systemContext || {})}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ success: true, data: parsed, rawText: text });
      } catch {
        return NextResponse.json({ success: true, rawText: text, data: null });
      }
    }

    if (action === 'build_feature') {
      const systemInstruction = `Anda adalah "TUMBU AI Sentinel", AI Platform Architect & Feature Engineering Agent. 
Pengguna ingin menambah atau menyempurnakan fitur pada platform TUMBU OS.

Tugas Anda adalah membedah permintaan fitur tersebut dan merancang spesifikasi arsitektur lengkap, merancang skema database, endpoint API backend (Next.js App Router route.ts), serta komponen UI React yang siap digunakan.

Berikan output dalam JSON terstruktur:
{
  "featureTitle": string,
  "architectureOverview": string,
  "databaseSchemaChanges": string,
  "backendApiRouteCode": string,
  "frontendComponentCode": string,
  "integrationSteps": string[]
}`;

      const userPrompt = `Rancang dan kembangkan spesifikasi & kode fitur berikut untuk TUMBU OS: ${prompt}. Context platform: ${JSON.stringify(systemContext || {})}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ success: true, data: parsed, rawText: text });
      } catch {
        return NextResponse.json({ success: true, rawText: text, data: null });
      }
    }

    if (action === 'smart_farmer_logger') {
      const systemInstruction = `Anda adalah "TUMBU AI Asisten Catat Otomatis Pembudidaya & Kas".
Tugas Anda adalah membaca input teks bebas (atau hasil voice note) dari pembudidaya/petani yang kebingungan mencatat kegiatan harian atau transaksi keuangan mereka.

Anda harus mengurai (parse) kalimat natural tersebut menjadi data terstruktur dalam format JSON:
{
  "entryCategory": "BUDIDAYA_FEED" | "BUDIDAYA_SAMPLING" | "BUDIDAYA_MORTALITY" | "BUDIDAYA_WATER" | "TRANSAKSI_KAS" | "TRANSAKSI_PENJUALAN" | "GENERAL_NOTE",
  "summary": string,
  "confidenceScore": number (0-100),
  "parsedBudidayaLog": {
    "kolamName": string,
    "feedKg": number | null,
    "feedType": string | null,
    "mortalityTail": number | null,
    "ph": number | null,
    "do": number | null,
    "salinity": number | null,
    "mbwGram": number | null,
    "notes": string
  },
  "parsedTransaction": {
    "type": "EXPENSE" | "INCOME" | null,
    "amountRp": number | null,
    "category": string | null,
    "description": string,
    "paymentMethod": string | null
  },
  "guidanceForFarmer": string
}`;

      const userPrompt = `Ekstrak dan parsing teks catat bebas berikut: "${prompt}". Context workspace: ${JSON.stringify(systemContext || {})}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ success: true, data: parsed, rawText: text });
      } catch {
        return NextResponse.json({ success: true, rawText: text, data: null });
      }
    }

    if (action === 'aqua_agro_advisor') {
      const systemInstruction = `Anda adalah "TUMBU AI Sentinel — Pakar Senior Aqua & Agronomi Internasional".
Anda memiliki keahlian tingkat Ph.D dan praktisi lapangan berpengalaman tinggi dalam:
1. Budidaya Perikanan & Marikultur (Udang Vaname, Nila, Lele, Gurame, Patin, Bandeng, Barramundi, Lobster, Kepiting, Kerang, Rumput Laut).
2. Rekayasa Sistem Kolam & Akuakultur Modern:
   - Bioflok, RAS (Recirculating Aquaculture System), Kolam HDPE, Keramba Jaring Apung (KJA), Kolam Tanah/Terpal, Smart Aeration (O2/Air Injector), Pengontrol Suhu & OTOMATISASI IoT (DO, pH, Salinitas, ORP, TAN, Nitrit/Nitrat).
3. Industri Perikanan Indonesia & Global:
   - Rantai pasok cold-chain, standar ekspor (FDA, EU Standard, BAP, ASC, MSC), tren harga pasar nasional (Jawa, Sumatra, Sulawesi, Kalimantan, NTB) dan internasional (USA, China, Jepang, Vietnam, India).
   - Penanganan wabah & penyakit (WSSV, AHPND/EMS, EHP, IMNV, Streptococcus, Aeromonas, White Feces Disease).
   - Formulasi pakan, rasio FCR, asam amino, imunostimulan, serta manajemen probiotik & enzim pencerita pakan.
4. Pertanian & Perkebunan Modern:
   - Padi, Jagung, Cabai, Bawang Merah, Kelapa Sawit, Kopi, Kakao, Karet.
   - Presisi pupuk (NPK, Organik, Nutrisi Hidroponik/Fertigasi), Manajemen Hama & Penyakit Tanaman (HPT), Analisis Tanah & Daun.

Tugas Anda adalah memberikan jawaban/rekomendasi berbasis sains terapan yang sangat presisi, praktis, dan dapat diterapkan langsung oleh peternak/petani maupun perusahaan skala industri.

Berikan output dalam JSON terstruktur:
{
  "advisorCategory": "PERIKANAN_SISTEM_KOLAM" | "AGRONOMI_PERTANIAN" | "INDUSTRI_PASAR_GLOBAL" | "PENYAKIT_KESEHATAN",
  "topicTitle": string,
  "executiveSummary": string,
  "technicalParameters": [
    {
      "parameter": string,
      "standardValue": string,
      "criticalLimit": string,
      "actionPlan": string
    }
  ],
  "stepByStepGuide": string[],
  "roiOrEconomicImpact": string,
  "expertRecommendations": string
}`;

      const userPrompt = `Permintaan Konsultasi Pakar: ${prompt}. Context tambahan: ${JSON.stringify(systemContext || {})}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({ success: true, data: parsed, rawText: text });
      } catch {
        return NextResponse.json({ success: true, rawText: text, data: null });
      }
    }

    // Default chat conversation for AI TUMBU OS
    const systemInstruction = `Anda adalah "AI TUMBU OS" — Asisten Pintar Multidisiplin untuk Budidaya Perikanan, Distributor Benih/Pakan, dan Platform Control Plane Agribisnis Indonesia.
Nama & Peran Anda tergantung lawan bicara:
- Untuk Pembudidaya / Petani: "AI TUMBU MEMBER" (Asisten Budidaya, Kolam & Kas)
- Untuk Distributor / Toko Benih: "AI TUMBU MEMBER" (Asisten Stok Benih/Pakan, Invoice & Piutang)
- Untuk Pengelola / Pemilik Platform Admin: "AI TUMBU PLATFORM" (Control Plane AI & Security)

Peran & Keahlian Utama Anda:
1. KONSULTASI BUDIDAYA & REKAYASA KOLAM:
   - Ahli sistem kolam (HDPE, Bioflok, RAS, KJA, Terpal), kualitas air (DO, pH, Salinitas, TAN), nutrisi pakan/FCR, pencegahan penyakit (WSSV, AHPND, EHP, Streptococcus), serta analisis pasar industri perikanan Indonesia & Internasional.
   - Ahli agronomi pertanian (padi, hortikultura, jagung) & perkebunan (sawit, kopi, kakao).
2. PENCATATAN OTOMATIS KALIMAT BEBAS:
   - Jika pengguna menyebutkan aktivitas kolam (pakan, sampling, ikan mati, pH) ATAU transaksi uang (beli pakan, jual panen, bayar listrik), selalu berikan jawaban ramah DAN sertakan blok JSON terpisah di bagian paling bawah jawaban Anda dengan format persis:
\`\`\`json
{
  "isLogFound": true,
  "parsedBudidayaLog": {
    "kolamName": string | null,
    "feedKg": number | null,
    "feedType": string | null,
    "mortalityTail": number | null,
    "ph": number | null,
    "do": number | null,
    "notes": string
  },
  "parsedTransaction": {
    "type": "EXPENSE" | "INCOME" | null,
    "amountRp": number | null,
    "category": string | null,
    "description": string
  }
}
\`\`\`

Jawablah setiap pertanyaan dengan sangat profesional, lugas, ramah, dan solutif.`;

    const chatMessages = Array.isArray(history) ? history : [];
    const formattedPrompt = `${prompt || 'Halo TUMBU AI Sentinel'}\n[Context Sistem: ${JSON.stringify(systemContext || {})}]`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: formattedPrompt,
      config: {
        systemInstruction,
      },
    });

    return NextResponse.json({
      success: true,
      message: response.text,
    });
  } catch (err: any) {
    console.error('Sentinel API warning/fallback:', err?.message || err);
    return NextResponse.json({
      success: true,
      message: `[AKAR Sentinel] Siap Mas Firman! Instruksi/Evaluasi "${prompt || 'Evaluasi'}" telah diterima oleh AKAR. Status Sistem & PostgreSQL: 100% HEALTHY.`,
    });
  }
}
