import{g as m,u as C,h as I}from"./apollo-e4ecfb61.js";import{b as E}from"./index-84246d85.js";import{r as _,k as $,v as b,ac as T,E as j,A as n,a9 as l,a5 as p,a7 as x,u as w,_ as R}from"./vue-b3dbcb9b.js";import"./supabase-cf010ec4.js";const D=m`
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
`,S=m`
  mutation ApproveReview($orgId: ID!, $id: ID!) {
    approveTaskReview(orgId: $orgId, id: $id) { id status }
  }
`,V=m`
  mutation RejectReview($orgId: ID!, $id: ID!, $reason: String) {
    rejectTaskReview(orgId: $orgId, id: $id, reason: $reason) { id status }
  }
`;function O(){var i;const c=E(),a=_({orgId:((i=c.currentOrg)==null?void 0:i.id)||"",limit:100,offset:0}),{result:o,loading:d,refetch:u}=C(D,a),{mutate:s}=I(S),{mutate:v}=I(V),r=_([]);return $(()=>{var t;a.value.orgId=((t=c.currentOrg)==null?void 0:t.id)||""}),$(()=>{var t;(t=o.value)!=null&&t.taskReviews&&(r.value=o.value.taskReviews)}),{items:r,loading:d,refetch:u,approve:s,reject:v}}const q=b({__name:"ApprovalsReviews",setup(c){const{items:a,loading:o,approve:d,reject:u,refetch:s}=O(),v=[{title:"Type",value:"type"},{title:"Status",value:"status"},{title:"Created",value:"createdAt"},{title:"Actions",value:"actions",sortable:!1}];async function r(t){var e;await d({orgId:(e=a.value[0])==null?void 0:e.orgId,id:t}),await s()}async function i(t){var e;await u({orgId:(e=a.value[0])==null?void 0:e.orgId,id:t}),await s()}return(t,e)=>{const g=p("v-btn"),k=p("v-data-table"),A=p("v-card");return x(),T("div",null,[e[2]||(e[2]=j("h2",null,"Approvals & Reviews",-1)),n(A,{class:"glass-card"},{default:l(()=>[n(k,{items:w(a),headers:v,loading:w(o),"item-key":"id",density:"compact"},{"item.actions":l(({item:f})=>[n(g,{size:"small",color:"success",class:"mr-2",onClick:y=>r(f.id)},{default:l(()=>e[0]||(e[0]=[R(" Approve ",-1)])),_:2,__:[0]},1032,["onClick"]),n(g,{size:"small",color:"error",onClick:y=>i(f.id)},{default:l(()=>e[1]||(e[1]=[R(" Reject ",-1)])),_:2,__:[1]},1032,["onClick"])]),_:1},8,["items","loading"])]),_:1})])}}});export{q as default};
