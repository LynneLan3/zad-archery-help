# Output contract

## Final report sections (fixed)

1. 输入摘要
2. 仓库上下文（workBranch / HEAD / identityMode / sourceBranchIndependentlyVerifiable）
3. 生成页面
4. 生成和修改文件
5. 素材及其状态
6. 验证结果
7. 警告与未确认信息
8. 视觉检查
9. Git 状态
10. 需要人工确认的事项

## Severity

| Level | Meaning | Delivery |
| --- | --- | --- |
| **Error** | Blocks generation or validation (identity failure, missing source, bad reference, collision, drift, build failure) | Must stop |
| **Warning** | Allowable with disclosure (Cloud `content-marker-verified`, `review-required` assets, unconfirmed facts marked in copy) | May deliver if listed |
| **Pass** | Check succeeded | Report as passed |

## Must-stop Errors

- `verify:context` failure (wrong remote, missing/mismatched `REPOSITORY_ID`, broken template structure)
- Wrong repository remote when remotes exist
- Missing critical sources / assets / `site-spec.yaml` (**after** identity passed — report as input Error)
- Non-managed overwrite collision
- Path traversal
- Unresolved placeholders
- Example Game residue in generated-site mode
- `validate:generated` / generator failures that cannot be fixed in scope
- Requests that require deploy, DNS, payment, or deleting unknown files

Technical generation/build success is not final V2 acceptance. The final V2
decision vocabulary is `PASS_V2_LAUNCH`,
`PASS_V2_WITH_VISUAL_DEGRADED`, or `FAIL_V2`, after the five QA layers in
`qa-checklist.md` are evaluated.

## Not identity Errors

- Local branch named `work`
- Detached HEAD
- Empty remotes when `content-marker-verified` succeeds
