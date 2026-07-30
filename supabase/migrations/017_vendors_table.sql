-- ============================================
-- MIGRATION: 017_vendors_table.sql
-- PURPOSE: Vendors master table for Purchase Orders
-- AUTHOR: System
-- DATE: 2024
-- PHASE: 3
-- DEPENDS ON: None
-- ============================================

-- ============================================
-- VENDOR STATUS ENUM
-- ============================================

CREATE TYPE vendor_status AS ENUM (
  'active',
  'inactive'
);
COMMENT ON TYPE vendor_status IS 'Vendor status';

-- ============================================
-- VENDORS TABLE
-- ============================================

CREATE TABLE vendors (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Vendor Identity
  vendor_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),

  -- Contact Information
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),

  -- Address (billing/main address)
  address_street VARCHAR(200),
  address_city VARCHAR(100),
  address_state VARCHAR(50),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(50) DEFAULT 'US',

  -- Business Terms
  payment_terms VARCHAR(100),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  tax_id VARCHAR(50),

  -- Status
  status vendor_status NOT NULL DEFAULT 'active',

  -- Notes
  notes TEXT,

  -- Audit Fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT vendors_name_length CHECK (LENGTH(TRIM(name)) >= 2),
  CONSTRAINT vendors_email_format CHECK (
    email IS NULL OR
    email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX idx_vendors_code_unique ON vendors(vendor_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_name ON vendors(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_status ON vendors(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendors_deleted_at ON vendors(deleted_at);
CREATE INDEX idx_vendors_created_at ON vendors(created_at);

-- Full-text search index
CREATE INDEX idx_vendors_search ON vendors
USING gin(to_tsvector('english', name || ' ' || COALESCE(vendor_code, '') || ' ' || COALESCE(contact_name, '')))
WHERE deleted_at IS NULL;

-- ============================================
-- SEQUENCE FOR VENDOR CODES
-- ============================================

CREATE SEQUENCE vendor_code_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Function to generate vendor code
CREATE OR REPLACE FUNCTION generate_vendor_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  seq_num := NEXTVAL('vendor_code_seq');
  RETURN 'VEN-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_vendor_code() IS 'Generates next vendor code in format VEN-NNNNN';

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for vendors
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view vendors
CREATE POLICY vendors_select ON vendors
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated'
  );

-- Insert requires permission
CREATE POLICY vendors_insert ON vendors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'vendors.create'
        AND u.deleted_at IS NULL
    )
  );

-- Update requires permission
CREATE POLICY vendors_update ON vendors
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'vendors.edit'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE vendors IS 'Vendor/supplier master table for purchase orders';
COMMENT ON COLUMN vendors.vendor_code IS 'Unique vendor code in format VEN-NNNNN';
COMMENT ON COLUMN vendors.name IS 'Vendor display name';
COMMENT ON COLUMN vendors.legal_name IS 'Legal/registered name of the vendor';
COMMENT ON COLUMN vendors.contact_name IS 'Primary contact person name';
COMMENT ON COLUMN vendors.payment_terms IS 'Payment terms (e.g., Net 30, Net 60)';
COMMENT ON COLUMN vendors.currency_code IS 'Default currency for transactions';
COMMENT ON COLUMN vendors.tax_id IS 'Tax identification number';
COMMENT ON COLUMN vendors.status IS 'Vendor status (active/inactive)';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS vendors_update ON vendors;
-- DROP POLICY IF EXISTS vendors_insert ON vendors;
-- DROP POLICY IF EXISTS vendors_select ON vendors;
-- DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
-- DROP FUNCTION IF EXISTS generate_vendor_code();
-- DROP SEQUENCE IF EXISTS vendor_code_seq;
-- DROP TABLE IF EXISTS vendors;
-- DROP TYPE IF EXISTS vendor_status;
