-- Sprint 5.0: Duplicate invoice fraud — blocked status

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'blocked';
