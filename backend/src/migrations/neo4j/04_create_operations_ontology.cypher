/* Create Operations Ontology nodes and relationships */
/* Based on 06-Operations-Ontology-Architecture.md */

/* Vendor constraints and indexes */
CREATE CONSTRAINT unique_vendor IF NOT EXISTS FOR (v:Vendor) REQUIRE v.id IS UNIQUE;
CREATE INDEX vendor_org_id IF NOT EXISTS FOR (v:Vendor) ON (v.org_id);
CREATE INDEX vendor_name IF NOT EXISTS FOR (v:Vendor) ON (v.name);
CREATE INDEX vendor_category IF NOT EXISTS FOR (v:Vendor) ON (v.category);
CREATE INDEX vendor_status IF NOT EXISTS FOR (v:Vendor) ON (v.status);

/* PurchaseOrder constraints and indexes */
CREATE CONSTRAINT unique_purchase_order IF NOT EXISTS FOR (po:PurchaseOrder) REQUIRE po.id IS UNIQUE;
CREATE INDEX po_org_id IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.org_id);
CREATE INDEX po_project_id IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.project_id);
CREATE INDEX po_vendor_id IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.vendor_id);
CREATE INDEX po_status IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.status);
CREATE INDEX po_number IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.po_number);
CREATE INDEX po_order_date IF NOT EXISTS FOR (po:PurchaseOrder) ON (po.order_date);

/* Invoice constraints and indexes */
CREATE CONSTRAINT unique_invoice IF NOT EXISTS FOR (i:Invoice) REQUIRE i.id IS UNIQUE;
CREATE INDEX invoice_org_id IF NOT EXISTS FOR (i:Invoice) ON (i.org_id);
CREATE INDEX invoice_project_id IF NOT EXISTS FOR (i:Invoice) ON (i.project_id);
CREATE INDEX invoice_vendor_id IF NOT EXISTS FOR (i:Invoice) ON (i.vendor_id);
CREATE INDEX invoice_po_id IF NOT EXISTS FOR (i:Invoice) ON (i.po_id);
CREATE INDEX invoice_status IF NOT EXISTS FOR (i:Invoice) ON (i.status);
CREATE INDEX invoice_number IF NOT EXISTS FOR (i:Invoice) ON (i.invoice_number);
CREATE INDEX invoice_date IF NOT EXISTS FOR (i:Invoice) ON (i.invoice_date);
CREATE INDEX invoice_due_date IF NOT EXISTS FOR (i:Invoice) ON (i.due_date);

/* Timesheet constraints and indexes */
CREATE CONSTRAINT unique_timesheet IF NOT EXISTS FOR (ts:Timesheet) REQUIRE ts.id IS UNIQUE;
CREATE INDEX timesheet_org_id IF NOT EXISTS FOR (ts:Timesheet) ON (ts.org_id);
CREATE INDEX timesheet_project_id IF NOT EXISTS FOR (ts:Timesheet) ON (ts.project_id);
CREATE INDEX timesheet_crew_id IF NOT EXISTS FOR (ts:Timesheet) ON (ts.crew_id);
CREATE INDEX timesheet_work_date IF NOT EXISTS FOR (ts:Timesheet) ON (ts.work_date);
CREATE INDEX timesheet_status IF NOT EXISTS FOR (ts:Timesheet) ON (ts.status);

/* PayrollBatch constraints and indexes */
CREATE CONSTRAINT unique_payroll_batch IF NOT EXISTS FOR (pb:PayrollBatch) REQUIRE pb.id IS UNIQUE;
CREATE INDEX payroll_batch_org_id IF NOT EXISTS FOR (pb:PayrollBatch) ON (pb.org_id);
CREATE INDEX payroll_batch_project_id IF NOT EXISTS FOR (pb:PayrollBatch) ON (pb.project_id);
CREATE INDEX payroll_batch_status IF NOT EXISTS FOR (pb:PayrollBatch) ON (pb.status);
CREATE INDEX payroll_batch_period IF NOT EXISTS FOR (pb:PayrollBatch) ON (pb.pay_period_start, pb.pay_period_end);

/* Budget constraints and indexes */
CREATE CONSTRAINT unique_budget IF NOT EXISTS FOR (b:Budget) REQUIRE b.id IS UNIQUE;
CREATE INDEX budget_org_id IF NOT EXISTS FOR (b:Budget) ON (b.org_id);
CREATE INDEX budget_project_id IF NOT EXISTS FOR (b:Budget) ON (b.project_id);
CREATE INDEX budget_status IF NOT EXISTS FOR (b:Budget) ON (b.status);
CREATE INDEX budget_version IF NOT EXISTS FOR (b:Budget) ON (b.version);

/* ComplianceRule constraints and indexes */
CREATE CONSTRAINT unique_compliance_rule IF NOT EXISTS FOR (cr:ComplianceRule) REQUIRE cr.id IS UNIQUE;
CREATE INDEX compliance_rule_org_id IF NOT EXISTS FOR (cr:ComplianceRule) ON (cr.org_id);
CREATE INDEX compliance_rule_category IF NOT EXISTS FOR (cr:ComplianceRule) ON (cr.category);
CREATE INDEX compliance_rule_status IF NOT EXISTS FOR (cr:ComplianceRule) ON (cr.status);
CREATE INDEX compliance_rule_severity IF NOT EXISTS FOR (cr:ComplianceRule) ON (cr.severity);

/* InsuranceDoc constraints and indexes */
CREATE CONSTRAINT unique_insurance_doc IF NOT EXISTS FOR (id:InsuranceDoc) REQUIRE id.id IS UNIQUE;
CREATE INDEX insurance_doc_org_id IF NOT EXISTS FOR (id:InsuranceDoc) ON (id.org_id);
CREATE INDEX insurance_doc_project_id IF NOT EXISTS FOR (id:InsuranceDoc) ON (id.project_id);
CREATE INDEX insurance_doc_type IF NOT EXISTS FOR (id:InsuranceDoc) ON (id.doc_type);
CREATE INDEX insurance_doc_status IF NOT EXISTS FOR (id:InsuranceDoc) ON (id.status);
CREATE INDEX insurance_doc_expiry IF NOT EXISTS FOR (id:InsuranceDoc) ON (id.expiry_date);

/* Financial relationship indexes */
CREATE INDEX po_scene_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.from_id, ef.valid_to);

CREATE INDEX budget_allocation_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.from_id, ef.valid_to);

CREATE INDEX compliance_application_relationships IF NOT EXISTS FOR (ef:EdgeFact) 
ON (ef.type, ef.from_id, ef.valid_to);
