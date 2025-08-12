import { Neo4jService } from './Neo4jService';
import { ProvenanceService } from './provenance/ProvenanceService';

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  category: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  tax_id?: string;
  payment_terms?: string;
  preferred_payment_method?: string;
  status: 'active' | 'inactive' | 'suspended';
  rating?: number;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface PurchaseOrder {
  id: string;
  org_id: string;
  project_id: string;
  po_number: string;
  vendor_id: string;
  scene_id?: string;
  crew_role?: string;
  description: string;
  amount: number;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
  order_date: Date;
  needed_date?: Date;
  delivery_address?: string;
  approved_by?: string;
  created_by: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Invoice {
  id: string;
  org_id: string;
  project_id: string;
  vendor_id: string;
  po_id?: string;
  invoice_number: string;
  amount: number;
  currency: string;
  tax_amount?: number;
  total_amount: number;
  invoice_date: Date;
  due_date: Date;
  status: 'received' | 'approved' | 'pending_payment' | 'paid' | 'disputed';
  payment_date?: Date;
  payment_method?: string;
  approved_by?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Timesheet {
  id: string;
  org_id: string;
  project_id: string;
  crew_id: string;
  shoot_day_id?: string;
  work_date: Date;
  call_time?: string;
  wrap_time?: string;
  meal_break_start?: string;
  meal_break_end?: string;
  regular_hours: number;
  overtime_hours?: number;
  double_time_hours?: number;
  regular_rate: number;
  overtime_rate?: number;
  double_time_rate?: number;
  total_amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'processed';
  submitted_by?: string;
  approved_by?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface Budget {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  total_budget: number;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'locked';
  version: string;
  approved_by?: string;
  approved_date?: Date;
  metadata?: {
    categories?: Record<string, number>;
    departments?: Record<string, number>;
    contingency_percentage?: number;
    [key: string]: any;
  };
  created_at?: Date;
  updated_at?: Date;
}

export interface ComplianceRule {
  id: string;
  org_id: string;
  name: string;
  category: 'safety' | 'union' | 'insurance' | 'permit';
  description: string;
  jurisdiction?: string;
  authority?: string;
  severity: 'mandatory' | 'recommended' | 'optional';
  effective_date: Date;
  expiry_date?: Date;
  status: 'active' | 'inactive' | 'superseded';
  metadata?: {
    triggers?: string[];
    requirements?: string[];
    documentation_required?: string[];
    penalties?: string;
    [key: string]: any;
  };
  created_at?: Date;
  updated_at?: Date;
}

export interface InsuranceDoc {
  id: string;
  org_id: string;
  project_id: string;
  doc_type: string;
  policy_number: string;
  carrier: string;
  coverage_amount: number;
  currency: string;
  effective_date: Date;
  expiry_date: Date;
  status: 'active' | 'expired' | 'cancelled';
  certificate_holder?: string;
  additional_insured?: string[];
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export class OperationsOntologyService {
  private neo4j: Neo4jService;
  private provenance: ProvenanceService;

  constructor() {
    this.neo4j = new Neo4jService();
    this.provenance = new ProvenanceService();
  }

  // ===== VENDOR OPERATIONS =====

  async createVendor(vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Vendor> {
    const vendorId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created vendor: " + $name,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_VENDOR",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create vendor
      CREATE (v:Vendor {
        id: $vendor_id,
        org_id: $org_id,
        name: $name,
        category: $category,
        contact_name: $contact_name,
        contact_email: $contact_email,
        contact_phone: $contact_phone,
        address: $address,
        tax_id: $tax_id,
        payment_terms: $payment_terms,
        preferred_payment_method: $preferred_payment_method,
        status: $status,
        rating: $rating,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to vendor for provenance
      CREATE (a)-[:TOUCHED]->(v)
      
      RETURN v
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      vendor_id: vendorId,
      org_id: vendor.org_id,
      user_id: userId,
      name: vendor.name,
      category: vendor.category,
      contact_name: vendor.contact_name || null,
      contact_email: vendor.contact_email || null,
      contact_phone: vendor.contact_phone || null,
      address: vendor.address || null,
      tax_id: vendor.tax_id || null,
      payment_terms: vendor.payment_terms || null,
      preferred_payment_method: vendor.preferred_payment_method || null,
      status: vendor.status,
      rating: vendor.rating || null,
      metadata: vendor.metadata || {},
      inputs: { name: vendor.name, category: vendor.category },
      outputs: { vendor_id: vendorId }
    }, vendor.org_id);

    return result.records[0]?.get('v').properties;
  }

  // ===== PURCHASE ORDER OPERATIONS =====

  async createPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<PurchaseOrder> {
    const poId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created purchase order: " + $po_number,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_PURCHASE_ORDER",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create purchase order
      CREATE (po:PurchaseOrder {
        id: $po_id,
        org_id: $org_id,
        project_id: $project_id,
        po_number: $po_number,
        vendor_id: $vendor_id,
        scene_id: $scene_id,
        crew_role: $crew_role,
        description: $description,
        amount: $amount,
        currency: $currency,
        status: $status,
        order_date: $order_date,
        needed_date: $needed_date,
        delivery_address: $delivery_address,
        approved_by: $approved_by,
        created_by: $created_by,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link to vendor
      MATCH (v:Vendor {id: $vendor_id, org_id: $org_id})
      CREATE (po)-[:FROM_VENDOR]->(v)
      
      // Link to scene if specified
      CALL apoc.do.when(
        $scene_id IS NOT NULL,
        "
        MATCH (s:Scene {id: $scene_id, org_id: $org_id})
        CREATE (ef:EdgeFact {
          id: randomUUID(),
          type: 'FOR_SCENE',
          from_id: po.id,
          to_id: s.id,
          valid_from: datetime(),
          valid_to: null,
          org_id: $org_id,
          created_by_commit: $commit_id
        })
        CREATE (ef)-[:FROM]->(po)
        CREATE (ef)-[:TO]->(s)
        RETURN ef
        ",
        "RETURN null",
        {po: po, scene_id: $scene_id, org_id: $org_id, commit_id: $commit_id}
      ) YIELD value
      
      // Link action to PO for provenance
      CREATE (a)-[:TOUCHED]->(po)
      
      RETURN po
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      po_id: poId,
      org_id: po.org_id,
      user_id: userId,
      project_id: po.project_id,
      po_number: po.po_number,
      vendor_id: po.vendor_id,
      scene_id: po.scene_id || null,
      crew_role: po.crew_role || null,
      description: po.description,
      amount: po.amount,
      currency: po.currency,
      status: po.status,
      order_date: po.order_date,
      needed_date: po.needed_date || null,
      delivery_address: po.delivery_address || null,
      approved_by: po.approved_by || null,
      created_by: po.created_by,
      metadata: po.metadata || {},
      inputs: { po_number: po.po_number, vendor_id: po.vendor_id, amount: po.amount },
      outputs: { po_id: poId }
    }, po.org_id);

    return result.records[0]?.get('po').properties;
  }

  // ===== INVOICE OPERATIONS =====

  async createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Invoice> {
    const invoiceId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created invoice: " + $invoice_number,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_INVOICE",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create invoice
      CREATE (i:Invoice {
        id: $invoice_id,
        org_id: $org_id,
        project_id: $project_id,
        vendor_id: $vendor_id,
        po_id: $po_id,
        invoice_number: $invoice_number,
        amount: $amount,
        currency: $currency,
        tax_amount: $tax_amount,
        total_amount: $total_amount,
        invoice_date: $invoice_date,
        due_date: $due_date,
        status: $status,
        payment_date: $payment_date,
        payment_method: $payment_method,
        approved_by: $approved_by,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link to vendor
      MATCH (v:Vendor {id: $vendor_id, org_id: $org_id})
      CREATE (i)-[:FROM_VENDOR]->(v)
      
      // Link to purchase order if specified
      CALL apoc.do.when(
        $po_id IS NOT NULL,
        "
        MATCH (po:PurchaseOrder {id: $po_id, org_id: $org_id})
        CREATE (i)-[:PERTAINS_TO]->(po)
        RETURN po
        ",
        "RETURN null",
        {i: i, po_id: $po_id, org_id: $org_id}
      ) YIELD value
      
      // Link action to invoice for provenance
      CREATE (a)-[:TOUCHED]->(i)
      
      RETURN i
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      invoice_id: invoiceId,
      org_id: invoice.org_id,
      user_id: userId,
      project_id: invoice.project_id,
      vendor_id: invoice.vendor_id,
      po_id: invoice.po_id || null,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      currency: invoice.currency,
      tax_amount: invoice.tax_amount || null,
      total_amount: invoice.total_amount,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      status: invoice.status,
      payment_date: invoice.payment_date || null,
      payment_method: invoice.payment_method || null,
      approved_by: invoice.approved_by || null,
      metadata: invoice.metadata || {},
      inputs: { invoice_number: invoice.invoice_number, vendor_id: invoice.vendor_id, amount: invoice.amount },
      outputs: { invoice_id: invoiceId }
    }, invoice.org_id);

    return result.records[0]?.get('i').properties;
  }

  // ===== BUDGET OPERATIONS =====

  async createBudget(budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Budget> {
    const budgetId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created budget: " + $name + " v" + $version,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_BUDGET",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create budget
      CREATE (b:Budget {
        id: $budget_id,
        org_id: $org_id,
        project_id: $project_id,
        name: $name,
        total_budget: $total_budget,
        currency: $currency,
        status: $status,
        version: $version,
        approved_by: $approved_by,
        approved_date: $approved_date,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to budget for provenance
      CREATE (a)-[:TOUCHED]->(b)
      
      RETURN b
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      budget_id: budgetId,
      org_id: budget.org_id,
      user_id: userId,
      project_id: budget.project_id,
      name: budget.name,
      total_budget: budget.total_budget,
      currency: budget.currency,
      status: budget.status,
      version: budget.version,
      approved_by: budget.approved_by || null,
      approved_date: budget.approved_date || null,
      metadata: budget.metadata || {},
      inputs: { project_id: budget.project_id, name: budget.name, total_budget: budget.total_budget },
      outputs: { budget_id: budgetId }
    }, budget.org_id);

    return result.records[0]?.get('b').properties;
  }

  // ===== COMPLIANCE OPERATIONS =====

  async createComplianceRule(rule: Omit<ComplianceRule, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<ComplianceRule> {
    const ruleId = this.generateId();
    const commitId = this.generateId();
    const actionId = this.generateId();

    const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created compliance rule: " + $name,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_COMPLIANCE_RULE",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create compliance rule
      CREATE (cr:ComplianceRule {
        id: $rule_id,
        org_id: $org_id,
        name: $name,
        category: $category,
        description: $description,
        jurisdiction: $jurisdiction,
        authority: $authority,
        severity: $severity,
        effective_date: $effective_date,
        expiry_date: $expiry_date,
        status: $status,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to rule for provenance
      CREATE (a)-[:TOUCHED]->(cr)
      
      RETURN cr
    `;

    const result = await this.neo4j.executeQuery(query, {
      commit_id: commitId,
      action_id: actionId,
      rule_id: ruleId,
      org_id: rule.org_id,
      user_id: userId,
      name: rule.name,
      category: rule.category,
      description: rule.description,
      jurisdiction: rule.jurisdiction || null,
      authority: rule.authority || null,
      severity: rule.severity,
      effective_date: rule.effective_date,
      expiry_date: rule.expiry_date || null,
      status: rule.status,
      metadata: rule.metadata || {},
      inputs: { name: rule.name, category: rule.category, severity: rule.severity },
      outputs: { rule_id: ruleId }
    }, rule.org_id);

    return result.records[0]?.get('cr').properties;
  }

  // ===== FINANCIAL REPORTING =====

  async getBudgetVsActualAnalysis(projectId: string, orgId: string): Promise<any> {
    const query = `
      MATCH (p:Project {id: $project_id, org_id: $org_id})
      MATCH (b:Budget {project_id: p.id, status: "approved"})
      
      // Get budget allocations by department
      WITH b, b.metadata.departments as budget_by_dept
      
      // Get actual spending
      MATCH (po:PurchaseOrder {project_id: p.id, status: "approved"})
      OPTIONAL MATCH (po)<-[:FROM]-(ef:EdgeFact {type: "FOR_SCENE"})-[:TO]->(s:Scene)
      
      WITH budget_by_dept, 
           collect({
               department: coalesce(po.metadata.department, "unassigned"),
               amount: po.amount,
               scene: s.number
           }) as actual_spending
      
      RETURN 
          budget_by_dept,
          actual_spending,
          [dept IN keys(budget_by_dept) | {
              department: dept,
              budgeted: budget_by_dept[dept],
              actual: reduce(total = 0.0, spend IN actual_spending | 
                  CASE WHEN spend.department = dept THEN total + spend.amount ELSE total END),
              variance: budget_by_dept[dept] - reduce(total = 0.0, spend IN actual_spending | 
                  CASE WHEN spend.department = dept THEN total + spend.amount ELSE total END)
          }] as variance_analysis
    `;

    const result = await this.neo4j.executeQuery(query, { project_id: projectId, org_id: orgId }, orgId);
    return result.records[0]?.get('variance_analysis') || [];
  }

  async getVendorPerformanceAnalysis(orgId: string): Promise<any[]> {
    const query = `
      MATCH (v:Vendor {org_id: $org_id})
      OPTIONAL MATCH (v)<-[:FROM_VENDOR]-(po:PurchaseOrder)
      OPTIONAL MATCH (v)<-[:FROM_VENDOR]-(i:Invoice)
      
      WITH v, 
           count(po) as total_pos,
           sum(po.amount) as total_po_amount,
           count(i) as total_invoices,
           sum(i.total_amount) as total_invoice_amount,
           avg(duration.between(po.order_date, i.invoice_date).days) as avg_delivery_days
      
      RETURN 
          v.name as vendor_name,
          v.category as category,
          v.rating as rating,
          total_pos,
          total_po_amount,
          total_invoices,
          total_invoice_amount,
          avg_delivery_days,
          CASE 
              WHEN avg_delivery_days <= 7 THEN "Excellent"
              WHEN avg_delivery_days <= 14 THEN "Good"
              WHEN avg_delivery_days <= 21 THEN "Fair"
              ELSE "Poor"
          END as delivery_performance
      ORDER BY total_po_amount DESC
    `;

    const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
    return result.records.map((record: any) => ({
      vendor_name: record.get('vendor_name'),
      category: record.get('category'),
      rating: record.get('rating'),
      total_pos: record.get('total_pos'),
      total_po_amount: record.get('total_po_amount'),
      total_invoices: record.get('total_invoices'),
      total_invoice_amount: record.get('total_invoice_amount'),
      avg_delivery_days: record.get('avg_delivery_days'),
      delivery_performance: record.get('delivery_performance')
    }));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
