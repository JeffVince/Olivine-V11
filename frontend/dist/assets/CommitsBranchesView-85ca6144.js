import{c as v,u as C,l as $}from"./apollo-30a378f4.js";import{b as S,u as x}from"./index-cc140e55.js";import{r as d,k as g,v as f,a7 as p,a8 as l,a4 as _,a6 as m,A as h,ab as I,ac as y,F as N,_ as D,W as E,d as T,E as A,u as b}from"./vue-3f691d55.js";import{_ as B}from"./_plugin-vue_export-helper-c27b6911.js";import"./supabase-cf010ec4.js";const k=v`
  query Commits($orgId: ID!, $branchName: String) {
    commits(orgId: $orgId, branchName: $branchName, limit: 50) {
      id
      message
      createdAt
    }
  }
`;function w(){var c;const s=S(),t=x(),e=d({orgId:((c=s.currentOrg)==null?void 0:c.id)||"",branchName:t.currentBranch}),{result:n,loading:r,refetch:o}=C(k,e),a=d([]);return g(()=>{var i;e.value.orgId=((i=s.currentOrg)==null?void 0:i.id)||"",e.value.branchName=t.currentBranch}),g(()=>{var i;(i=n.value)!=null&&i.commits&&(a.value=n.value.commits)}),{items:a,loading:r,refetch:o}}const L=v`
  query Branches($orgId: ID!) { branches(orgId: $orgId) { id name description active baseCommitId } }
`,M=v`
  mutation CreateBranch($orgId: ID!, $name: String!, $description: String) { createBranch(input: { orgId: $orgId, name: $name, description: $description }) { id } }
`,O=v`
  mutation MergeBranch($orgId: ID!, $source: String!, $target: String!, $message: String!, $author: String!) {
    mergeBranch(input: { orgId: $orgId, sourceBranch: $source, targetBranch: $target, mergeMessage: $message, author: $author }) { id }
  }
`;function V(){var i;const s=S(),t=d({orgId:((i=s.currentOrg)==null?void 0:i.id)||""}),{result:e,loading:n,refetch:r}=C(L,t),o=d([]);g(()=>{var u;t.value.orgId=((u=s.currentOrg)==null?void 0:u.id)||""}),g(()=>{var u;(u=e.value)!=null&&u.branches&&(o.value=e.value.branches)});const{mutate:a}=$(M),{mutate:c}=$(O);return{branches:o,loading:n,refetch:r,create:a,merge:c}}const R=f({__name:"CommitTimeline",props:{commits:{}},setup(s){const t=e=>new Date(e).toLocaleDateString();return(e,n)=>{const r=_("v-list-item"),o=_("v-list"),a=_("v-card");return m(),p(a,{title:"Commit Timeline",class:"glass-card"},{default:l(()=>[h(o,{density:"compact"},{default:l(()=>[(m(!0),I(N,null,y(e.commits,c=>(m(),p(r,{key:c.id,title:c.message,subtitle:t(c.createdAt)},null,8,["title","subtitle"]))),128))]),_:1})]),_:1})}}});const q=B(R,[["__scopeId","data-v-8c151770"]]),H=f({__name:"BranchList",props:{branches:{}},setup(s){return(t,e)=>{const n=_("v-chip"),r=_("v-card-text"),o=_("v-card");return m(),p(o,{class:"mt-4 glass-card",title:"Branches"},{default:l(()=>[h(r,null,{default:l(()=>[(m(!0),I(N,null,y(t.branches,a=>(m(),p(n,{key:a.id,class:"ma-1",color:a.active?"primary":void 0},{default:l(()=>[D(E(a.name),1)]),_:2},1032,["color"]))),128))]),_:1})]),_:1})}}});const j=B(H,[["__scopeId","data-v-35b1f766"]]);T({loading:!1,error:null});const F=f({__name:"CommitsBranchesView",setup(s){const{items:t}=w(),{branches:e}=V();return(n,r)=>(m(),I("div",null,[r[0]||(r[0]=A("h2",null,"Commits & Branches",-1)),h(q,{commits:b(t)},null,8,["commits"]),h(j,{branches:b(e)},null,8,["branches"])]))}});const J=B(F,[["__scopeId","data-v-ee37d826"]]);export{J as default};
