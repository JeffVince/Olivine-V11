export interface Vendor {
    id: string;
    org_id: string;
    name: string;
    category?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    tax_id?: string;
    payment_terms?: string;
    preferred_payment_method?: string;
    status: 'active' | 'inactive' | 'suspended';
    rating?: number;
    metadata?: Record<string, unknown>;
    created_at?: Date;
    updated_at?: Date;
}
export interface PurchaseOrder {
    id: string;
    org_id: string;
    vendor_id: string;
    project_id?: string;
    order_number: string;
    description?: string;
    total_amount: number;
    currency?: string;
    order_date: Date;
    needed_date?: Date;
    delivery_address?: string;
    approved_by?: string;
    created_by: string;
    status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';
    scene_id?: string;
    crew_role?: string;
    metadata?: Record<string, unknown>;
    created_at?: Date;
    updated_at?: Date;
}
export interface Invoice {
    id: string;
    org_id: string;
    vendor_id: string;
    project_id?: string;
    invoice_number: string;
    description?: string;
    total_amount: number;
    amount?: number;
    currency?: string;
    tax_amount?: number;
    po_id?: string;
    invoice_date: Date;
    due_date: Date;
    status: 'received' | 'approved' | 'pending_payment' | 'paid' | 'disputed';
    payment_date?: Date;
    payment_method?: string;
    approved_by?: string;
    metadata?: Record<string, unknown>;
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
    metadata?: Record<string, unknown>;
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
        [key: string]: unknown;
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
        [key: string]: unknown;
    };
    created_at?: Date;
    updated_at?: Date;
}
export interface InsuranceDoc {
    id: string;
    org_id: string;
    project_id?: string;
    policy_number: string;
    insurer: string;
    coverage_type: string;
    coverage_amount: number;
    premium_amount: number;
    start_date: Date;
    expiry_date: Date;
    status: 'active' | 'expired' | 'cancelled';
    certificate_holder?: string;
    additional_insured?: string[];
    metadata?: Record<string, unknown>;
    created_at?: Date;
    updated_at?: Date;
}
export declare class OperationsOntologyService {
    private neo4j;
    private provenance;
    constructor();
    createVendor(vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Vendor>;
    createPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<PurchaseOrder>;
    createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Invoice>;
    createBudget(budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Budget>;
    createComplianceRule(rule: Omit<ComplianceRule, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<ComplianceRule>;
    getBudgetVsActualAnalysis(projectId: string, orgId: string): Promise<unknown>;
    getVendorPerformanceAnalysis(orgId: string): Promise<unknown[]>;
    private generateId;
}
//# sourceMappingURL=OperationsOntologyService.d.ts.map