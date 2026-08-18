import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ErpService } from './erp.service';
import { ExcelImportService } from './excel-import.service';
import { Roles } from '../auth/roles.decorator';

@Controller('erp')
export class ErpController {
  constructor(
    private readonly erp: ErpService,
    private readonly excelImport: ExcelImportService,
  ) {}

  @Get('dashboard') dashboard() { return this.erp.dashboard(); }
  @Get('products') products() { return this.erp.listProducts(); }
  @Get('fishery-commodity-options') fisheryCommodityOptions() { return this.erp.listFisheryCommodityOptions(); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('products') createProduct(@Body() body: object) { return this.erp.createProduct(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('products/adjust-stock') adjustStock(@Body() body: object) { return this.erp.adjustStock(body); }
  @Get('partners') partners(@Query('type') type?: 'CUSTOMER' | 'SUPPLIER') { return this.erp.listPartners(type); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('partners') createPartner(@Body() body: object) { return this.erp.createPartner(body); }
  @Get('cash') cash() { return this.erp.listCash(); }
  @Get('cash/kategori') cashKategori() { return this.erp.kategoriPengeluaran(); }
  @Get('cash/rekap') cashRekap(
    @Query('mode') mode?: string,
    @Query('periode') periode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dari') dari?: string,
    @Query('sampai') sampai?: string,
    @Query('keterangan') keterangan?: string,
  ) {
    return this.erp.rekapPengeluaran({ mode, periode, from, to, dari, sampai, keterangan });
  }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('cash') createCash(@Body() body: object) { return this.erp.createCash(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('cash/batch') createCashBatch(@Body() body: object) { return this.erp.createCashBatch(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Patch('cash') updateCash(@Body() body: object) { return this.erp.updateCash(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('cash/delete') deleteCash(@Body() body: object) { return this.erp.deleteCash(body); }
  @Get('transactions') transactions(@Query('type') type?: 'SALE' | 'PURCHASE') { return this.erp.listTransactions(type); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('transactions') createTransaction(@Body() body: object) { return this.erp.createTransaction(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Patch('transactions') updateTransaction(@Body() body: object) { return this.erp.updateTransaction(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('transactions/delete') deleteTransaction(@Body() body: object) { return this.erp.deleteTransaction(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('transactions/pay') payTransaction(@Body() body: object) { return this.erp.payTransaction(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('berita-acara/import-po') importBa(@Body() body: object) { return this.erp.importBaToPurchase(body); }
  @Get('berita-acara/preview-po') previewBaPo(@Query('baId') baId?: string) { return this.erp.previewBaToPurchase({ baId }); }
  @Get('sizes') sizes() { return this.erp.listSizes(); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('sizes') createSize(@Body() body: object) { return this.erp.createSize(body); }
  @Get('reports') reports(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('jenis') jenis?: string,
  ) {
    return this.erp.report({ from, to, jenis });
  }
  @Get('documents/invoice') invoice(@Query('transactionId') transactionId?: string) {
    return this.erp.documentTransaksi({ transactionId, forceType: 'SALE' });
  }
  @Get('documents/nota-pembelian') nota(@Query('transactionId') transactionId?: string) {
    return this.erp.documentTransaksi({ transactionId, forceType: 'PURCHASE' });
  }
  @Get('berita-acara') beritaAcara() { return this.erp.listBeritaAcara(); }
  @Get('berita-acara/sisa-notes') baSisaNotes(
    @Query('supplier') supplier?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.erp.listBaSisaNotes({ supplier, excludeId });
  }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('berita-acara') createBeritaAcara(@Body() body: object) { return this.erp.createBeritaAcara(body); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Patch('berita-acara') updateBeritaAcara(@Body() body: object) { return this.erp.updateBeritaAcara(body); }
  @Get('surat-jalan') suratJalan() { return this.erp.listSuratJalan(); }
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post('surat-jalan') createSuratJalan(@Body() body: object) { return this.erp.createSuratJalan(body); }
  @Get('finance') finance(
    @Query('dari') dari?: string,
    @Query('sampai') sampai?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.erp.financeSummary({ dari, sampai, from, to });
  }
  @Get('settings') settings() { return this.erp.companySettings(); }
  @Roles('OWNER', 'ADMIN')
  @Patch('settings') updateSettings(@Body() body: object) { return this.erp.updateCompanySettings(body); }
  @Get('document-gaps') documentGaps() { return this.erp.documentNumberGaps(); }
  @Get('closings') closings() { return this.erp.listClosings(); }
  @Get('closings/status') closingStatus() { return this.erp.closingStatus(); }
  @Get('closings/preview') closingPreview(@Query('periodYm') periodYm?: string) {
    return this.erp.closingPreview({ periodYm });
  }
  @Get('closings/rekap') closingRekap(
    @Query('periode') periode?: string,
    @Query('dari') dari?: string,
    @Query('sampai') sampai?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.erp.closingRekap({ periode, dari, sampai, from, to });
  }
  @Get('closings/rugi') getRugi() { return this.erp.getRugiDitahan(); }
  @Roles('OWNER', 'ADMIN')
  @Post('closings') closePeriod(@Body() body: object) { return this.erp.closePeriod(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('closings/reopen') reopenPeriod(@Body() body: object) { return this.erp.reopenPeriod(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('closings/rugi') setRugi(@Body() body: object) { return this.erp.setRugiDitahan(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('closings/rugi/clear') clearRugi() { return this.erp.clearRugiDitahan(); }
  @Roles('OWNER', 'ADMIN')
  @Get('backup') backup() { return this.erp.exportBackup(); }
  @Roles('OWNER', 'ADMIN')
  @Post('backup/reset') resetData(@Body() body: object) { return this.erp.resetBusinessData(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('backup/restore') restore(@Body() body: object) { return this.erp.importBackup(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('import') importData(@Body() body: object) { return this.erp.importBackup(body); }
  @Roles('OWNER', 'ADMIN')
  @Get('import/excel/catalog') excelCatalog() { return this.excelImport.catalog(); }
  @Roles('OWNER', 'ADMIN')
  @Post('import/excel/parse') excelParse(@Body() body: object) { return this.excelImport.parse(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('import/excel/preview') excelPreview(@Body() body: object) { return this.excelImport.preview(body); }
  @Roles('OWNER', 'ADMIN')
  @Post('import/excel/commit') excelCommit(@Body() body: object) { return this.excelImport.commit(body); }
  @Get('documents/kwitansi') kwitansi(
    @Query('source') source?: string,
    @Query('transactionId') transactionId?: string,
    @Query('cashId') cashId?: string,
    @Query('baId') baId?: string,
    @Query('amount') amount?: string,
    @Query('partner') partner?: string,
    @Query('note') note?: string,
  ) {
    return this.erp.documentKwitansi({
      source,
      transactionId,
      cashId,
      baId,
      amount: amount != null ? Number(amount) : undefined,
      partner,
      note,
    });
  }
  @Get('documents/berita-acara') docBa(@Query('id') id?: string) { return this.erp.documentBeritaAcara({ id }); }
  @Get('documents/surat-jalan') docSj(@Query('id') id?: string) { return this.erp.documentSuratJalan({ id }); }
  @Get('documents/rekap-pengeluaran') rekapOut(
    @Query('mode') mode?: string,
    @Query('periode') periode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dari') dari?: string,
    @Query('sampai') sampai?: string,
    @Query('keterangan') keterangan?: string,
  ) {
    return this.erp.documentRekapPengeluaran({ mode, periode, from, to, dari, sampai, keterangan });
  }
  @Get('documents/kop-preview') docKopPreview() {
    return this.erp.documentKopPreview();
  }
  @Get('documents/tutup-buku') docTutup(
    @Query('periodYm') periodYm?: string,
    @Query('keterangan') keterangan?: string,
    @Query('sementara') sementara?: string,
    @Query('dari') dari?: string,
    @Query('sampai') sampai?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.erp.documentTutupBuku({
      periodYm,
      keterangan,
      sementara: sementara === '1' || sementara === 'true',
      dari, sampai, from, to,
    });
  }
  @Get('documents/laporan') docLaporan(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('jenis') jenis?: string,
  ) {
    return this.erp.documentLaporan({ from, to, jenis });
  }
}
