'use client';

import React from 'react';
import { printThermalReceipt, openPrintDocument } from './print';

export interface PrintDialogData {
  title: string;
  number: string;
  date: string;
  partnerName: string;
  partnerRole: string;
  items: Array<{ name: string; sizeLabel?: string; qty: number; price: number; total: number }>;
  totalAmount: number;
  notes?: string;
  driver?: string;
  vehicle?: string;
  officialHtml?: string;
}

interface PrintDialogProps {
  data: PrintDialogData | null;
  onClose: () => void;
}

export function PrintDialog({ data, onClose }: PrintDialogProps) {
  if (!data) return null;

  const handlePrintThermal = () => {
    printThermalReceipt({
      title: data.title,
      number: data.number,
      date: data.date,
      partnerName: data.partnerName,
      partnerRole: data.partnerRole,
      items: data.items,
      totalAmount: data.totalAmount,
      notes: data.notes,
      driver: data.driver,
      vehicle: data.vehicle,
    });
    onClose();
  };

  const handlePrintPDF = () => {
    if (data.officialHtml) {
      openPrintDocument(data.title, data.officialHtml, `${data.number}.pdf`);
    } else {
      // Fallback HTML preview
      const fallbackHtml = `
        <div style="padding:20px; font-family:sans-serif;">
          <h2>${data.title} - ${data.number}</h2>
          <p>Tanggal: ${data.date}</p>
          <p>${data.partnerRole}: ${data.partnerName}</p>
          <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; margin-top:10px;">
            <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead>
            <tbody>
              ${data.items.map((i) => `<tr><td>${i.name} ${i.sizeLabel || ''}</td><td>${i.qty}</td><td>Rp ${i.price}</td><td>Rp ${i.total}</td></tr>`).join('')}
            </tbody>
          </table>
          <h3>Total: Rp ${data.totalAmount.toLocaleString('id-ID')}</h3>
        </div>
      `;
      openPrintDocument(data.title, fallbackHtml, `${data.number}.pdf`);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 31, 61, 0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#FFFFFF',
          borderRadius: 24,
          padding: 20,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          color: '#0A1F3D',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0A1F3D' }}>🖨️ Pilih Opsi Cetak Dokumen</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#64748B', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
          Dokumen <b style={{ color: '#0A1F3D' }}>{data.number}</b> siap dicetak. Pilih metode printer yang sesuai:
        </div>

        {/* 2 OPTION CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* OPTION 1: THERMAL BLUETOOTH */}
          <button
            type="button"
            onClick={handlePrintThermal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 14,
              borderRadius: 16,
              background: '#F8FAFC',
              border: '2px solid #00D084',
              color: '#0A1F3D',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#00D084',
                color: '#0A1F3D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              📟
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0A1F3D' }}>
                1. Printer Thermal Bluetooth (58mm / 80mm)
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                Format struk portable kasir untuk cetak langsung dari HP di kolam/lapangan.
              </div>
            </div>
          </button>

          {/* OPTION 2: PDF DOCUMENT */}
          <button
            type="button"
            onClick={handlePrintPDF}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 14,
              borderRadius: 16,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#0A1F3D',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#0A1F3D',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              📄
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0A1F3D' }}>
                2. Dokumen PDF Resmi (A4 / F4 Office)
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                Format lembar kertas resmi lengkap dengan logo, stamp, dan tanda tangan.
              </div>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            height: 42,
            borderRadius: 12,
            border: '1px solid #CBD5E1',
            background: 'transparent',
            color: '#64748B',
            fontWeight: 700,
            fontSize: 12,
            marginTop: 16,
            cursor: 'pointer',
          }}
        >
          Batal
        </button>
      </div>
    </div>
  );
}
