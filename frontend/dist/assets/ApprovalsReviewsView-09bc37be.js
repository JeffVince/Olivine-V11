import{c as w,u as j,l as R}from"./apollo-30a378f4.js";import{b as h}from"./index-cc140e55.js";import{r as v,k as $,c as b,v as k,a7 as T,a8 as m,a4 as _,a6 as y,A as g,_ as A,ab as E,E as S,u as f}from"./vue-3f691d55.js";import"./supabase-cf010ec4.js";const V=w`
  query TaskReviews($orgId: ID!, $limit: Int, $offset: Int) {
    taskReviews(orgId: $orgId, limit: $limit, offset: $offset) {
      id
      type
      orgId
      status
      createdAt
      targetId
      context
    }
  }
`,B=w`
  mutation ApproveReview($orgId: ID!, $id: ID!) {
    approveTaskReview(orgId: $orgId, id: $id) { id status }
  }
`,D=w`
  mutation RejectReview($orgId: ID!, $id: ID!, $reason: String) {
    rejectTaskReview(orgId: $orgId, id: $id, reason: $reason) { id status }
  }
`;function L(){var d;const s=h(),c=v({orgId:((d=s.currentOrg)==null?void 0:d.id)||"",limit:100,offset:0}),{result:n,loading:u,refetch:r}=j(V,c),{mutate:o}=R(B),{mutate:t}=R(D),e=v([]);return $(()=>{var i;c.value.orgId=((i=s.currentOrg)==null?void 0:i.id)||""}),$(()=>{var i;(i=n.value)!=null&&i.taskReviews&&(e.value=n.value.taskReviews)}),{items:e,loading:u,refetch:r,approve:o,reject:t}}function x(){const{items:s,loading:c,approve:n,reject:u,refetch:r}=L(),o=v(""),t=v(null),e=v(null),d=b(()=>s.value.filter(a=>{const l=o.value?a.type.toLowerCase().includes(o.value.toLowerCase())||a.status.toLowerCase().includes(o.value.toLowerCase()):!0,p=t.value?a.status===t.value:!0,C=e.value?a.type===e.value:!0;return l&&p&&C}));async function i(a){const l=s.value.find(p=>p.id===a);l&&(await n({orgId:l.orgId,id:a}),await r())}async function I(a){const l=s.value.find(p=>p.id===a);l&&(await u({orgId:l.orgId,id:a}),await r())}return{items:s,loading:c,searchQuery:o,statusFilter:t,typeFilter:e,filteredItems:d,handleApprove:i,handleReject:I,refetch:r}}const O=k({__name:"ApprovalsTable",props:{items:{},loading:{type:Boolean}},emits:["approve","reject"],setup(s,{emit:c}){const n=c,u=[{title:"Type",value:"type"},{title:"Status",value:"status"},{title:"Created",value:"createdAt"},{title:"Actions",value:"actions",sortable:!1}];function r(t){n("approve",t)}function o(t){n("reject",t)}return(t,e)=>{const d=_("v-btn"),i=_("v-data-table"),I=_("v-card");return y(),T(I,{class:"glass-card"},{default:m(()=>[g(i,{items:t.items,headers:u,loading:t.loading,"item-key":"id",density:"compact"},{"item.actions":m(({item:a})=>[g(d,{size:"small",color:"success",class:"mr-2",onClick:l=>r(a.id)},{default:m(()=>e[0]||(e[0]=[A(" Approve ",-1)])),_:2,__:[0]},1032,["onClick"]),g(d,{size:"small",color:"error",onClick:l=>o(a.id)},{default:m(()=>e[1]||(e[1]=[A(" Reject ",-1)])),_:2,__:[1]},1032,["onClick"])]),_:1},8,["items","loading"])]),_:1})}}}),M=k({__name:"ApprovalsReviewsView",setup(s){const{items:c,loading:n,filteredItems:u,handleApprove:r,handleReject:o}=x();return(t,e)=>(y(),E("div",null,[e[0]||(e[0]=S("h2",null,"Approvals & Reviews",-1)),g(O,{items:f(u),loading:f(n),onApprove:f(r),onReject:f(o)},null,8,["items","loading","onApprove","onReject"])]))}});export{M as default};
