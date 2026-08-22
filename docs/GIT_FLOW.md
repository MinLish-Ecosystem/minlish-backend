# Git Flow — Minlish Backend

> **Người viết:** Minlish Team  
> **Ngày:** 15/08/2026  
> **Phiên bản:** 1.1.0
---

## 1. Tổng quan các nhánh

```
main (production)
 │
 ├── release/v1.0  ──PR──>  main        (chuẩn bị release)
 │
develop (integration — nơi mọi thứ hội tụ)
 │
 ├── feature/auth  ──PR──>  develop     (tính năng lớn, hoàn chỉnh mới PR)
 │    │
 │    ├── task/auth-google-ui  ──PR──>  feature/auth
 │    ├── task/auth-session    ──PR──>  feature/auth
 │    └── task/auth-apple-ui   ──PR──>  feature/auth
 │
 ├── bugfix/login-error  ──PR──>  develop
 └── refactor/auth-service  ──PR──>  develop

hotfix/critical-fix  ──PR──>  main (gấp, bỏ qua develop)
```

| Nhánh | Tạo từ | PR vào | Xóa khi nào |
|-------|--------|--------|-------------|
| `main` | — | — | Không bao giờ |
| `develop` | — | — | Không bao giờ |
| `feature/{tên}` | `develop` | `develop` | Sau khi merge vào develop |
| `task/{tên}` | `feature/{cha}` | `feature/{cha}` | Ngay sau khi merge vào feature |
| `release/{tên}` | `develop` | `main` + merge ngược `develop` | Sau khi release xong |
| `bugfix/{tên}` | `develop` | `develop` | Sau khi merge |
| `hotfix/{tên}` | `main` | `main` + cherry-pick sang `develop` | Sau khi merge |

---

## 2. Quy trình hàng ngày: Feature → Task → PR

Đây là luồng chính. Bạn **không push thẳng code lên `develop`**. Thay vào đó:

```
develop → feature/tên → task/tên → PR vào feature → feature hoàn chỉnh → PR vào develop
```

### Bước 1 — Tạo feature từ develop

```bash
git checkout develop
git pull origin develop
git checkout -b feature/auth
```

### Bước 2 — Tạo task từ feature (mỗi đầu việc 1 task)

```bash
git checkout feature/auth
git pull origin feature/auth
git checkout -b task/auth-google-ui
```

### Bước 3 — Code, commit, push

```bash
git add <file>
git commit -m "feat(auth): build Google login UI"
git push origin task/auth-google-ui
```

### Bước 4 — Tạo PR: `task/auth-google-ui` → `feature/auth`

Trước khi tạo PR, rebase lên feature cha:

```bash
git checkout task/auth-google-ui
git pull --rebase origin feature/auth
git push --force-with-lease origin task/auth-google-ui
```

→ Tạo PR trên GitHub: **`task/auth-google-ui` → `feature/auth`**
→ Được approve → Merge trên GitHub

### Bước 5 — Xóa task sau khi merge

```bash
git checkout feature/auth
git pull origin feature/auth
git branch -d task/auth-google-ui
git push origin --delete task/auth-google-ui
```

### Bước 6 — Lặp lại cho các task khác

Mỗi task xong → PR vào `feature/auth` → merge → xóa task. Feature cha cứ thế đầy dần.

### Bước 7 — Feature hoàn chỉnh → PR vào develop

```bash
git checkout feature/auth
git pull --rebase origin develop
git push --force-with-lease origin feature/auth
```

→ Tạo PR trên GitHub: **`feature/auth` → `develop`**
→ Được approve → Merge trên GitHub → Xóa feature branch

---

## 3. Nhánh Release (chuẩn bị đưa lên production)

Nhánh `release` được tạo khi `develop` đã đủ tính năng cho 1 phiên bản. Mục đích: **test lần cuối, sửa bug nhỏ, không thêm tính năng mới**.

```
develop ──> release/v1.0 ──> main (production)
                    │
                    └── merge ngược lại develop (nếu có bugfix trong release)
```

### Tạo release

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.0
git push origin release/v1.0
```

### Trong nhánh release — chỉ sửa bug, không thêm tính năng

```bash
git add <file>
git commit -m "fix: correct validation error message"
git push origin release/v1.0
```

### Khi release sẵn sàng — merge vào main

```bash
git checkout main
git pull origin main
git merge release/v1.0 --no-ff
git tag v1.0.0
git push origin main --tags
```

### Merge ngược lại develop (nếu có fix trong release)

```bash
git checkout develop
git pull origin develop
git merge release/v1.0 --no-ff
git push origin develop
```

### Xóa release branch

```bash
git branch -d release/v1.0
git push origin --delete release/v1.0
```

### Tóm tắt release bằng hình:

```
develop ────────────────────────────────────────────────────────────
   │                                                        ▲
   └── release/v1.0 ─── fix bug nhỏ ─── merge vào main     │ merge ngược
                                            │               │ (nếu có fix)
                                            ▼               │
                                          main ──────────────┘
                                          tag: v1.0.0
```

---

## 4. Hotfix (sửa lỗi production gấp)

Bỏ qua develop, đi thẳng từ `main`.

```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-login-bug

git add <file>
git commit -m "hotfix: fix login crash"
git push origin hotfix/critical-login-bug
```

→ PR: **`hotfix/critical-login-bug` → `main`**
→ Merge xong → cherry-pick sang develop:

```bash
git checkout develop
git pull origin develop
git cherry-pick <hotfix-commit-hash>
git push origin develop
```

→ Xóa hotfix branch.

---

## 5. Xử lý conflict (dùng chung cho mọi trường hợp)

Nguyên tắc: **rebase lên branch mà bạn định PR vào**.

| PR vào đâu | Rebase từ đâu |
|------------|---------------|
| `develop` | `origin/develop` |
| `feature/x` | `origin/feature/x` |
| `main` | `origin/main` |

```bash
git pull --rebase origin <branch-đích>

# Nếu có conflict:
# 1. Mở file bị conflict, sửa phần <<<<<<< / ======= / >>>>>>>
# 2. git add <file>
# 3. git rebase --continue
#    (Lặp lại nếu conflict ở commit kế tiếp)
#    Muốn bỏ: git rebase --abort

git push --force-with-lease origin <branch-của-bạn>
```

> Không dùng `git commit` giữa chừng rebase. Không dùng `--force` trần, luôn dùng `--force-with-lease`.

---

## 6. Commit Message

```
<type>: <mô tả ngắn>
```

| Type | Dùng khi | Ví dụ |
|------|----------|-------|
| `feat` | Thêm tính năng | `feat: add Google OAuth login` |
| `fix` | Sửa lỗi | `fix: resolve login timeout` |
| `hotfix` | Sửa lỗi production gấp | `hotfix: fix crash on startup` |
| `docs` | Tài liệu | `docs: update API docs` |
| `refactor` | Cải thiện code, không đổi behavior | `refactor: simplify auth middleware` |
| `test` | Thêm/sửa test | `test: add auth service tests` |
| `chore` | Config, dependencies | `chore: update dependencies` |
| `style` | Format code | `style: format imports` |

---

## 7. Cheatsheet nhanh

```bash
# Tạo branch
git checkout -b feature/tên          # từ develop
git checkout -b task/tên             # từ feature cha
git checkout -b release/v1.0         # từ develop
git checkout -b hotfix/tên           # từ main

# Sync
git pull origin develop              # pull thường
git pull --rebase origin develop     # pull + rebase (khuyên dùng trước PR)

# Push
git push origin <branch>             # push thường
git push --force-with-lease origin <branch>  # push sau rebase

# Xóa branch
git branch -d <branch>               # xóa local (đã merge)
git push origin --delete <branch>    # xóa remote

# Xem lịch sử
git log --oneline --graph --all
```

---

## 8. Những điều KHÔNG làm

- Không push trực tiếp lên `main` hoặc `develop`
- Không commit thẳng trên `main` hoặc `develop`
- Không dùng `--force` trần (luôn `--force-with-lease`)
- Không thêm tính năng mới trong nhánh `release` — chỉ fix bug
- Không để branch task/feature tồn tại quá lâu sau khi đã merge

---

**Maintained by Minlish Team**