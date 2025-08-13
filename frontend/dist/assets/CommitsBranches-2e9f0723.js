import{g as v,u as b,h as $}from"./apollo-e4ecfb61.js";import{b as N,u as y}from"./index-84246d85.js";import{r as _,k as p,v as E,ac as I,E as A,A as h,a9 as l,a5 as d,a7 as g,F as f,ad as B,u as C,a8 as S,_ as k,W as x}from"./vue-b3dbcb9b.js";import"./supabase-cf010ec4.js";const M=v`
  query Commits($orgId: ID!, $branchName: String) {
    commits(orgId: $orgId, branchName: $branchName, limit: 50) {
      id
      message
      createdAt
    }
  }
`;function O(){var a;const o=N(),r=y(),t=_({orgId:((a=o.currentOrg)==null?void 0:a.id)||"",branchName:r.currentBranch}),{result:u,loading:c,refetch:i}=b(M,t),m=_([]);return p(()=>{var e;t.value.orgId=((e=o.currentOrg)==null?void 0:e.id)||"",t.value.branchName=r.currentBranch}),p(()=>{var e;(e=u.value)!=null&&e.commits&&(m.value=u.value.commits)}),{items:m,loading:c,refetch:i}}const D=v`
  query Branches($orgId: ID!) { branches(orgId: $orgId) { id name description active baseCommitId } }
`,R=v`
  mutation CreateBranch($orgId: ID!, $name: String!, $description: String) { createBranch(input: { orgId: $orgId, name: $name, description: $description }) { id } }
`,T=v`
  mutation MergeBranch($orgId: ID!, $source: String!, $target: String!, $message: String!, $author: String!) {
    mergeBranch(input: { orgId: $orgId, sourceBranch: $source, targetBranch: $target, mergeMessage: $message, author: $author }) { id }
  }
`;function q(){var e;const o=N(),r=_({orgId:((e=o.currentOrg)==null?void 0:e.id)||""}),{result:t,loading:u,refetch:c}=b(D,r),i=_([]);p(()=>{var n;r.value.orgId=((n=o.currentOrg)==null?void 0:n.id)||""}),p(()=>{var n;(n=t.value)!=null&&n.branches&&(i.value=t.value.branches)});const{mutate:m}=$(R),{mutate:a}=$(T);return{branches:i,loading:u,refetch:c,create:m,merge:a}}const F=E({__name:"CommitsBranches",setup(o){const{items:r}=O(),{branches:t}=q();return(u,c)=>{const i=d("v-list-item"),m=d("v-list"),a=d("v-card"),e=d("v-chip"),n=d("v-card-text");return g(),I("div",null,[c[0]||(c[0]=A("h2",null,"Commits & Branches",-1)),h(a,{title:"Commit Timeline",class:"glass-card"},{default:l(()=>[h(m,{density:"compact"},{default:l(()=>[(g(!0),I(f,null,B(C(r),s=>(g(),S(i,{key:s.id,title:s.message,subtitle:s.createdAt},null,8,["title","subtitle"]))),128))]),_:1})]),_:1}),h(a,{class:"mt-4 glass-card",title:"Branches"},{default:l(()=>[h(n,null,{default:l(()=>[(g(!0),I(f,null,B(C(t),s=>(g(),S(e,{key:s.id,class:"ma-1",color:s.active?"primary":void 0},{default:l(()=>[k(x(s.name),1)]),_:2},1032,["color"]))),128))]),_:1})]),_:1})])}}});export{F as default};
