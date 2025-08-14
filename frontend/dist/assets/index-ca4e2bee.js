import{g as v,u as C,h as B}from"./apollo-9599811a.js";import{b as S,u as N}from"./index-c29b4afb.js";import{r as d,k as g,v as f,a8 as p,a9 as l,a5 as _,a7 as m,A as h,ac as I,ad as y,F as x,_ as D,W as E,b as T,E as A,u as b}from"./vue-b3dbcb9b.js";import{_ as $}from"./_plugin-vue_export-helper-c27b6911.js";import"./supabase-cf010ec4.js";const k=v`
  query Commits($orgId: ID!, $branchName: String) {
    commits(orgId: $orgId, branchName: $branchName, limit: 50) {
      id
      message
      createdAt
    }
  }
`;function L(){var c;const n=S(),t=N(),e=d({orgId:((c=n.currentOrg)==null?void 0:c.id)||"",branchName:t.currentBranch}),{result:s,loading:r,refetch:o}=C(k,e),a=d([]);return g(()=>{var i;e.value.orgId=((i=n.currentOrg)==null?void 0:i.id)||"",e.value.branchName=t.currentBranch}),g(()=>{var i;(i=s.value)!=null&&i.commits&&(a.value=s.value.commits)}),{items:a,loading:r,refetch:o}}const M=v`
  query Branches($orgId: ID!) { branches(orgId: $orgId) { id name description active baseCommitId } }
`,O=v`
  mutation CreateBranch($orgId: ID!, $name: String!, $description: String) { createBranch(input: { orgId: $orgId, name: $name, description: $description }) { id } }
`,R=v`
  mutation MergeBranch($orgId: ID!, $source: String!, $target: String!, $message: String!, $author: String!) {
    mergeBranch(input: { orgId: $orgId, sourceBranch: $source, targetBranch: $target, mergeMessage: $message, author: $author }) { id }
  }
`;function q(){var i;const n=S(),t=d({orgId:((i=n.currentOrg)==null?void 0:i.id)||""}),{result:e,loading:s,refetch:r}=C(M,t),o=d([]);g(()=>{var u;t.value.orgId=((u=n.currentOrg)==null?void 0:u.id)||""}),g(()=>{var u;(u=e.value)!=null&&u.branches&&(o.value=e.value.branches)});const{mutate:a}=B(O),{mutate:c}=B(R);return{branches:o,loading:s,refetch:r,create:a,merge:c}}const w=f({__name:"CommitTimeline",props:{commits:{}},setup(n){const t=e=>new Date(e).toLocaleDateString();return(e,s)=>{const r=_("v-list-item"),o=_("v-list"),a=_("v-card");return m(),p(a,{title:"Commit Timeline",class:"glass-card"},{default:l(()=>[h(o,{density:"compact"},{default:l(()=>[(m(!0),I(x,null,y(e.commits,c=>(m(),p(r,{key:c.id,title:c.message,subtitle:t(c.createdAt)},null,8,["title","subtitle"]))),128))]),_:1})]),_:1})}}});const H=$(w,[["__scopeId","data-v-d3830359"]]),V=f({__name:"BranchList",props:{branches:{}},setup(n){return(t,e)=>{const s=_("v-chip"),r=_("v-card-text"),o=_("v-card");return m(),p(o,{class:"mt-4 glass-card",title:"Branches"},{default:l(()=>[h(r,null,{default:l(()=>[(m(!0),I(x,null,y(t.branches,a=>(m(),p(s,{key:a.id,class:"ma-1",color:a.active?"primary":void 0},{default:l(()=>[D(E(a.name),1)]),_:2},1032,["color"]))),128))]),_:1})]),_:1})}}});const j=$(V,[["__scopeId","data-v-35b1f766"]]);T({loading:!1,error:null});const F=f({__name:"index",setup(n){const{items:t}=L(),{branches:e}=q();return(s,r)=>(m(),I("div",null,[r[0]||(r[0]=A("h2",null,"Commits & Branches",-1)),h(H,{commits:b(t)},null,8,["commits"]),h(j,{branches:b(e)},null,8,["branches"])]))}});const J=$(F,[["__scopeId","data-v-a1022f29"]]);export{J as default};
