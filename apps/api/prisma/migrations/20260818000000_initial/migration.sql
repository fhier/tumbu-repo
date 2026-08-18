-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'MEMBER', 'VIEWER', 'TECHNICIAN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "tenantId" TEXT NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blueprint" TEXT NOT NULL DEFAULT 'distributor',
    "blueprintId" TEXT NOT NULL DEFAULT 'operational_distributor',
    "modulesJson" TEXT NOT NULL DEFAULT '[]',
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "planId" TEXT,
    "commercialStatus" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "graceUntil" TIMESTAMP(3),
    "customTitle" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "locale" TEXT NOT NULL DEFAULT 'id-ID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "membershipRole" TEXT NOT NULL DEFAULT 'STAFF',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "monthlyAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "priceMonthly" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "priceYearly" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "modulesJson" TEXT NOT NULL DEFAULT '[]',
    "workspaceQuota" INTEGER NOT NULL DEFAULT 1,
    "maxPonds" INTEGER NOT NULL DEFAULT 10,
    "maxCycles" INTEGER NOT NULL DEFAULT 5,
    "maxMembers" INTEGER NOT NULL DEFAULT 3,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformBillingProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT,
    "legalName" TEXT,
    "tagline" TEXT,
    "address" TEXT,
    "npwp" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "bankAccount" TEXT,
    "bankHolder" TEXT,
    "taxNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "defaultPlanName" TEXT NOT NULL DEFAULT '',
    "defaultAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dueDays" INTEGER NOT NULL DEFAULT 7,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "remindBeforeDays" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodYm" TEXT NOT NULL,
    "planName" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "dueDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "paymentProvider" TEXT,
    "paymentExternalId" TEXT,
    "paymentProviderRef" TEXT,
    "paymentCheckoutUrl" TEXT,
    "paymentChannel" TEXT,
    "proofFileBase64" TEXT,
    "proofFileName" TEXT,
    "proofMime" TEXT,
    "proofUploadedAt" TIMESTAMP(3),
    "proofStatus" TEXT NOT NULL DEFAULT 'NONE',
    "proofPath" TEXT,
    "proofNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderDispatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "kind" TEXT,
    "dedupeKey" TEXT,
    "invoiceId" TEXT,
    "payloadJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "businessName" TEXT NOT NULL,
    "convertedTenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterestLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ekor',
    "stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sizeLabel" TEXT,
    "commodityCategory" TEXT,
    "species" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'IN',
    "account" TEXT NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SALE',
    "date" TIMESTAMP(3) NOT NULL,
    "partner" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "notes" TEXT,
    "account" TEXT NOT NULL DEFAULT 'CASH',
    "baId" TEXT,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "feeAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "weight" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sampling" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "flaseType" TEXT,
    "flasePercent" DECIMAL(65,30),
    "bonusQty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sizeLabel" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'ekor',
    "species" TEXT,
    "commodityCategory" TEXT,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionFee" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "TransactionFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodYm" TEXT NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "totalPembelian" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPenjualan" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPengeluaran" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "jumlahPembelian" INTEGER NOT NULL DEFAULT 0,
    "jumlahPenjualan" INTEGER NOT NULL DEFAULT 0,
    "jumlahPengeluaran" INTEGER NOT NULL DEFAULT 0,
    "alreadyClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL DEFAULT 'admin',

    CONSTRAINT "ClosingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeritaAcara" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dateDepart" TIMESTAMP(3),
    "supplier" TEXT NOT NULL,
    "refNumber" TEXT,
    "vehicle" TEXT,
    "pondLocation" TEXT,
    "checker" TEXT NOT NULL DEFAULT '',
    "adminName" TEXT NOT NULL DEFAULT '',
    "receiver" TEXT,
    "plasePercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dpNote" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "transport" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "jasaBongkar" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "upahSopir" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "priorDebtNote" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "priorDebtRef" TEXT,
    "payMethodNote" TEXT NOT NULL DEFAULT '',
    "notaAktual" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPlase" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTagihan" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalUangMasuk" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sisaEstimasi" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAwal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAktual" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "purchaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeritaAcara_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeritaAcaraLine" (
    "id" TEXT NOT NULL,
    "beritaAcaraId" TEXT NOT NULL,
    "binNote" TEXT,
    "sizeLabel" TEXT NOT NULL,
    "qtyInitial" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "BeritaAcaraLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuratJalan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customer" TEXT NOT NULL,
    "saleRef" TEXT,
    "destination" TEXT,
    "vehicle" TEXT,
    "driver" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuratJalan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuratJalanLine" (
    "id" TEXT NOT NULL,
    "suratJalanId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sizeLabel" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bagCount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "binNote" TEXT,

    CONSTRAINT "SuratJalanLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnerId" TEXT,
    "locationLabel" TEXT NOT NULL,
    "brand" TEXT,
    "acType" TEXT,
    "capacity" TEXT,
    "serialNumber" TEXT,
    "notes" TEXT,
    "lastServiceAt" TIMESTAMP(3),
    "nextServiceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "serviceAddress" TEXT,
    "partnerId" TEXT,
    "assetUnitId" TEXT,
    "scheduleAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "extraCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "beforeNotes" TEXT,
    "afterNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderLine" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemType" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "WorkOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "serviceAddress" TEXT,
    "notes" TEXT,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "workOrderId" TEXT,
    "validUntil" TIMESTAMP(3),
    "linesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "yymmdd" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncIdempotency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "response" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payloadJson" TEXT NOT NULL,
    "notes" TEXT,
    "invoiceId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaPond" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaM2" DECIMAL(65,30),
    "volumeM3" DECIMAL(65,30),
    "location" TEXT,
    "systemType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaPond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaSpeciesProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetFcr" DECIMAL(65,30),
    "targetSrPct" DECIMAL(65,30),
    "defaultDensity" DECIMAL(65,30),
    "densityUnit" TEXT,
    "typicalDays" INTEGER,
    "typicalFcr" DECIMAL(65,30),
    "typicalSrPct" DECIMAL(65,30),
    "targetWeightGram" DECIMAL(65,30),
    "defaultPriceHint" DECIMAL(65,30),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaSpeciesProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaCultureCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pondId" TEXT NOT NULL,
    "speciesProfileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PLANNED',
    "seedSupplierPartnerId" TEXT,
    "initialCapital" DECIMAL(65,30),
    "notes" TEXT,
    "targetSrPct" DECIMAL(65,30),
    "targetFcr" DECIMAL(65,30),
    "targetWeightGram" DECIMAL(65,30),
    "targetDays" INTEGER,
    "targetBopAmount" DECIMAL(65,30),
    "targetHarvestKg" DECIMAL(65,30),
    "targetRevenue" DECIMAL(65,30),
    "categoryTargetsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),

    CONSTRAINT "AquaCultureCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaFeedType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "proteinPct" DECIMAL(65,30),
    "pricePerKg" DECIMAL(65,30),
    "defaultPrice" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaFeedType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaStrain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "speciesProfileId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaStrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "symbol" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaCostCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "costClass" TEXT NOT NULL DEFAULT '',
    "costNature" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaCostCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaMortalityCause" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaMortalityCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaIndicatorRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "greenBound" DECIMAL(65,30) NOT NULL,
    "yellowBound" DECIMAL(65,30) NOT NULL,
    "speciesProfileId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquaIndicatorRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaStockingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "quantityPcs" DECIMAL(65,30) NOT NULL,
    "averageWeightGram" DECIMAL(65,30),
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AquaStockingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaFeedEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "feedTypeId" TEXT NOT NULL,
    "quantityKg" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "AquaFeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaSamplingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "averageWeightGram" DECIMAL(65,30) NOT NULL,
    "sampleCountPcs" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "AquaSamplingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaMortalityEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "deadCountPcs" DECIMAL(65,30) NOT NULL,
    "cause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "AquaMortalityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaHarvestEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "quantityKg" DECIMAL(65,30) NOT NULL,
    "quantityPcs" DECIMAL(65,30) NOT NULL,
    "grade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "AquaHarvestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaExpenseEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "partnerId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "AquaExpenseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaRevenueEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AquaRevenueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaMedicineEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "treatmentKind" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "AquaMedicineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceTransactionId" TEXT NOT NULL,
    "sourceTransactionType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "metaJson" TEXT,

    CONSTRAINT "FinancialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquaCycleCloseEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'RECORDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AquaCycleCloseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE INDEX "Tenant_planId_idx" ON "Tenant"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPlan_code_key" ON "PlatformPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_number_key" ON "PlatformInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_tenantId_periodYm_key" ON "PlatformInvoice"("tenantId", "periodYm");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Size_tenantId_label_key" ON "Size"("tenantId", "label");

-- CreateIndex
CREATE INDEX "Partner_tenantId_idx" ON "Partner"("tenantId");

-- CreateIndex
CREATE INDEX "CashEntry_tenantId_date_idx" ON "CashEntry"("tenantId", "date");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_date_idx" ON "Transaction"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_tenantId_number_key" ON "Transaction"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingPeriod_tenantId_periodYm_key" ON "ClosingPeriod"("tenantId", "periodYm");

-- CreateIndex
CREATE UNIQUE INDEX "BeritaAcara_tenantId_number_key" ON "BeritaAcara"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SuratJalan_tenantId_number_key" ON "SuratJalan"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_tenantId_number_key" ON "WorkOrder"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_tenantId_number_key" ON "Quotation"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DocCounter_tenantId_docType_yymmdd_key" ON "DocCounter"("tenantId", "docType", "yymmdd");

-- CreateIndex
CREATE UNIQUE INDEX "SyncIdempotency_tenantId_idempotencyKey_key" ON "SyncIdempotency"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "AquaPond_tenantId_code_key" ON "AquaPond"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AquaSpeciesProfile_tenantId_code_key" ON "AquaSpeciesProfile"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AquaCultureCycle_tenantId_code_key" ON "AquaCultureCycle"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvent_idempotencyKey_key" ON "FinancialEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialEvent_tenantId_sourceTransactionId_idx" ON "FinancialEvent"("tenantId", "sourceTransactionId");

-- CreateIndex
CREATE INDEX "FinancialEvent_tenantId_idempotencyKey_idx" ON "FinancialEvent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_idempotencyKey_key" ON "Settlement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Settlement_tenantId_sourceTransactionId_idx" ON "Settlement"("tenantId", "sourceTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_eventId_key" ON "JournalEntry"("eventId");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Size" ADD CONSTRAINT "Size_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEntry" ADD CONSTRAINT "CashEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFee" ADD CONSTRAINT "TransactionFee_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosingPeriod" ADD CONSTRAINT "ClosingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeritaAcara" ADD CONSTRAINT "BeritaAcara_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeritaAcaraLine" ADD CONSTRAINT "BeritaAcaraLine_beritaAcaraId_fkey" FOREIGN KEY ("beritaAcaraId") REFERENCES "BeritaAcara"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuratJalan" ADD CONSTRAINT "SuratJalan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuratJalanLine" ADD CONSTRAINT "SuratJalanLine_suratJalanId_fkey" FOREIGN KEY ("suratJalanId") REFERENCES "SuratJalan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUnit" ADD CONSTRAINT "AssetUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderLine" ADD CONSTRAINT "WorkOrderLine_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaPond" ADD CONSTRAINT "AquaPond_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaSpeciesProfile" ADD CONSTRAINT "AquaSpeciesProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaCultureCycle" ADD CONSTRAINT "AquaCultureCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaCultureCycle" ADD CONSTRAINT "AquaCultureCycle_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "AquaPond"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaCultureCycle" ADD CONSTRAINT "AquaCultureCycle_speciesProfileId_fkey" FOREIGN KEY ("speciesProfileId") REFERENCES "AquaSpeciesProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaFeedType" ADD CONSTRAINT "AquaFeedType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaStrain" ADD CONSTRAINT "AquaStrain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaStrain" ADD CONSTRAINT "AquaStrain_speciesProfileId_fkey" FOREIGN KEY ("speciesProfileId") REFERENCES "AquaSpeciesProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaUnit" ADD CONSTRAINT "AquaUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaCostCategory" ADD CONSTRAINT "AquaCostCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaMortalityCause" ADD CONSTRAINT "AquaMortalityCause_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaIndicatorRule" ADD CONSTRAINT "AquaIndicatorRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquaExpenseEvent" ADD CONSTRAINT "AquaExpenseEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AquaCostCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

