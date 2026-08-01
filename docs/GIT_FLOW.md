# Git Workflow & Branching Strategy

> **Nguyên tắc vàng:** 🚫 TUYỆT ĐỐI KHÔNG push trực tiếp lên branch `main`!

## 1. Branch Hierarchy

```text
┌─────────────────────────────────────────────────────────────┐
│                         main                                │
│                    (PRODUCTION)                              │
│              Chỉ merge khi release ổn định                  │
│                    🚫 KHÔNG push trực tiếp                  │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │  PR từ develop (release ready)
                              │
┌─────────────────────────────────────────────────────────────┐
│                        develop                               │
│                    (INTEGRATION)                             │
│           Tất cả features merge vào đây                     │
│              Test tích hợp trước khi release                │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │  PR từ feature/*
                              │
┌─────────────────────────────────────────────────────────────┐
│                   feature/{tên-tính-năng}                   │
│                    (TÍNH NĂNG MỚI)                           │
│              Code tính năng cụ thể tại đây                  │
│         Tạo branch TỪ develop, code xong PR vào develop     │
└─────────────────────────────────────────────────────────────┘
```

## 2. Branch Types & Naming Convention

| Type | Pattern | Example | Mục đích |
|------|---------|---------|----------|
| **Main** | `main` | `main` | Production — chỉ từ release |
| **Develop** | `develop` | `develop` | Integration — tất cả features |
| **Feature** | `feature/{tên}` | `feature/auth`, `feature/vocab-api` | Tính năng mới |
| **Task** | `task/{tên}` | `task/auth-google-ui` | 1 đầu việc con trong 1 feature (xem mục 4) |
| **Bugfix** | `bugfix/{tên}` | `bugfix/login-error` | Sửa lỗi |
| **Hotfix** | `hotfix/{tên}` | `hotfix/critical-patch` | Sửa lỗi production gấp |
| **Refactor** | `refactor/{tên}` | `refactor/auth-service` | Cải thiện code |

## 3. Quy Trình Làm Việc Chi Tiết

### Bước 1: Bắt Đầu Tính Năng Mới
```bash
# Luôn luôn bắt đầu từ develop mới nhất
git checkout develop
git pull origin develop

# Tạo feature branch
git checkout -b feature/auth-google-login
```

### Bước 2: Code Tính Năng
```bash
# Code thoải mái, commit thường xuyên
# (git add . chỉ an toàn khi .gitignore đã chặn rác AI tool: .qoder/ .github/agents/ ...)
git add .
git commit -m "feat: add Google OAuth integration"

# Push lên remote (để backup & CI chạy)
git push origin feature/auth-google-login
```

### Bước 3: Đồng Bộ & Xử Lý Conflict TRƯỚC Khi Tạo PR
> Khi tính năng đã xong, **đừng tạo PR vội**. Kéo branch đích mới nhất về rồi **rebase** feature branch lên nó, để mọi conflict được giải quyết trên máy mình — PR tạo ra sẽ sạch, thẳng, dễ review.
>
> 💡 Nguyên tắc: **rebase lên branch mà bạn ĐỊNH merge vào** (branch đích).
> - PR vào `develop`        → rebase từ `develop`
> - PR task vào `feature/x` → rebase từ `feature/x`

```bash
# 1. Đảm bảo đang đứng trên feature branch
git checkout feature/auth-google-login

# 2. Kéo develop mới nhất về và rebase feature lên nó
#    (pull --rebase = fetch + rebase trong 1 lệnh)
git pull --rebase origin develop
```

**Nếu KHÔNG có conflict** → rebase chạy mượt tới cuối, nhảy thẳng Bước 4.

**Nếu CÓ conflict** → git dừng lại tại commit đang vướng và báo file kẹt. Lặp vòng này cho tới hết:

```text
VÒNG LẶP XỬ LÝ CONFLICT TRONG REBASE
1. Mở file bị conflict, sửa phần  <<<<<<<  /  =======  /  >>>>>>>
2. git add <file-vừa-sửa>        <- đánh dấu đã giải quyết
3. git rebase --continue         <- TIẾP TỤC (KHÔNG dùng git commit)
   ↳ Nếu lại conflict ở commit kế -> quay về bước 1

BỎ CUỘC, quay về trạng thái trước rebase:  git rebase --abort
```

> ⚠️ **Bẫy hay dính:** trong rebase, sau khi sửa conflict xong bạn `git add` rồi `git rebase --continue`, **KHÔNG** gõ `git commit`. Git tự áp lại commit cho bạn — gõ `commit` giữa chừng là hỏng luồng rebase.

Sau khi rebase sạch, lịch sử feature branch đã bị **viết lại** nên push thường sẽ bị từ chối (non-fast-forward). Push lại bằng lệnh **an toàn**:

```bash
# 3. Push lại feature branch đã rebase
#    --force-with-lease: chỉ đè khi remote chưa bị ai khác push thêm (an toàn)
#    🚫 TUYỆT ĐỐI KHÔNG dùng --force trần
git push --force-with-lease origin feature/auth-google-login
```

Giờ feature branch đã "nằm gọn" trên đỉnh `develop` mới nhất → **chắc chắn không còn conflict** khi merge. Tạo PR được rồi.

### Bước 4: Tạo Pull Request
```text
┌─────────────────────────────────────────────────────────────┐
│  PR: feature/auth-google-login -> develop                   │
├─────────────────────────────────────────────────────────────┤
│  [x] Rebased onto develop, conflicts resolved locally       │
│  [x] CI/CD green (lint, test, build)                        │
│  [x] Reviewed (>= 1 approval)                               │
│  [x] No conflict with develop                               │
│  [x] Docs updated (Swagger, comments)                       │
└─────────────────────────────────────────────────────────────┘
```

### Bước 5: Merge vào Develop
```bash
# Cách khuyến nghị: bấm nút Merge trên GitHub (Squash / Merge commit)
# sau khi PR đã approve — KHÔNG merge thủ công rồi push develop từ máy.

# Sau khi merge xong trên GitHub, dọn dẹp local:
git checkout develop
git pull origin develop

# Xóa feature branch (đã merge xong)
git branch -d feature/auth-google-login
git push origin --delete feature/auth-google-login
```

---

## 4. Workflow Feature → Task (chia nhỏ tính năng)

> **Quy ước tên branch:**
> - `feature/<tên>` = tính năng lớn / epic (branch **CHA**). Sống dai, **chưa PR đi đâu** cho tới khi gom đủ các đầu việc bên trong.
> - `task/<tên>`    = 1 đầu việc cụ thể (branch **CON**): 1 màn hình, 1 API, 1 fix con… Xong → **PR về lại `feature/` cha** (KHÔNG phải develop), merge xong là **xóa**.
> - Khi **toàn bộ feature hoàn chỉnh** → `feature/` cha mới **PR vào `develop`**.
>
> Nguyên tắc rebase giữ nguyên: **rebase lên branch đích của PR** → task rebase `feature/` cha, feature rebase `develop`.

```text
develop ─────────────────────────────────────────────────────
   │
   └── feature/auth ─────────────────────────────────────────   <- PR -> develop (khi HOÀN CHỈNH)
          │
          ├── task/auth-google-ui   ─── PR -> feature/auth
          ├── task/auth-apple-ui    ─── PR -> feature/auth
          └── task/auth-session-fix ─── PR -> feature/auth
```

```text
┌─────────────────────────────────────────────────────────────┐
│  Task PR:  task/auth-google-ui  ->  feature/auth            │
├─────────────────────────────────────────────────────────────┤
│  [x] Rebased onto feature/auth, conflicts resolved locally  │
│  [x] CI/CD green (lint, test, build)                        │
│  [x] Reviewed (>= 1 approval)                               │
│  [x] No conflict with feature branch                        │
│  [x] Docs / comments updated                                │
└─────────────────────────────────────────────────────────────┘
```

```bash
# === 1. Tạo feature CHA từ develop mới nhất ===
git checkout develop
git pull origin develop
git checkout -b feature/auth

# === 2. Tạo task CON từ feature cha (đứng trên feature/auth rồi mới tạo) ===
git checkout feature/auth
git pull origin feature/auth
git checkout -b task/auth-google-ui

# === 3. Code đúng 1 đầu việc đó, commit, push ===
git add .
git commit -m "feat(auth): build Google login UI"
git push origin task/auth-google-ui

# === 4. Xong task -> rebase lên feature CHA (branch ĐÍCH) rồi tạo PR ===
git checkout task/auth-google-ui
git pull --rebase origin feature/auth
#   nếu conflict: sửa file -> git add <file> -> git rebase --continue
#   (tuyệt đối KHÔNG git commit giữa chừng rebase)
git push --force-with-lease origin task/auth-google-ui
#   -> Bấm Create PR trên GitHub:  task/auth-google-ui  ->  feature/auth
#   -> Sau khi approve: merge TRÊN GitHub, rồi dọn task:
git checkout feature/auth
git pull origin feature/auth
git branch -d task/auth-google-ui
git push origin --delete task/auth-google-ui

# === 5. Lặp lại bước 2->4 cho các task khác (task/auth-apple-ui, ...) ===
#       Mỗi task xong lại PR về feature/auth, feature/auth cứ thế đầy lên.

# === 6. feature/auth HOÀN CHỈNH -> rebase lên develop rồi mới PR ===
git checkout feature/auth
git pull --rebase origin develop
git push --force-with-lease origin feature/auth
#   -> Bấm Create PR trên GitHub:  feature/auth  ->  develop
```

---

## 5. Hotfix Workflow (Sửa Lỗi Production Gấp)

> Hotfix luôn **bắt đầu từ `main`** (vì production chạy trên `main`). Trước khi PR vẫn rebase `main` mới nhất cho đồng bộ nguyên tắc "rebase từ đích". Sau khi merge vào `main` thì **cherry-pick sang `develop`** để develop không bị thiếu bản sửa.

```bash
# 1. Tạo hotfix từ main mới nhất
git checkout main
git pull origin main
git checkout -b hotfix/critical-login-bug

# 2. Code fix gấp, commit
git add .
git commit -m "hotfix: fix login session timeout"

# 3. Rebase lên main mới nhất trước khi PR (giống mục 3, Bước 3)
git pull --rebase origin main
#   nếu conflict: sửa -> git add <file> -> git rebase --continue
git push --force-with-lease origin hotfix/critical-login-bug
#   -> Bấm Create PR trên GitHub:  hotfix/critical-login-bug  ->  main
#   -> Merge TRÊN GitHub sau khi approve (hotfix có thể duyệt nhanh)

# 4. Đem bản sửa sang develop bằng cherry-pick
git checkout develop
git pull origin develop
git cherry-pick <hotfix-commit-hash>
#   nếu conflict: sửa file -> git add <file> -> git cherry-pick --continue
#   bỏ cuộc:  git cherry-pick --abort
git push origin develop

# 5. Dọn hotfix branch
git branch -d hotfix/critical-login-bug
git push origin --delete hotfix/critical-login-bug
```

> 📌 Nếu hotfix gồm **nhiều commit**, thay `git cherry-pick <hash>` bằng `git cherry-pick <hash-dau>^..<hash-cuoi>` (cherry-pick cả dãy), hoặc merge `main` vào `develop` nếu team cho phép.

---

## 6. Git Commands Cheatsheet

```bash
# === BRANCH MANAGEMENT ===
git branch                        # Xem danh sách branch local
git branch -a                     # Xem tất cả branches (local + remote)
git checkout -b feature/name      # Tạo và switch sang feature branch
git checkout -b task/name         # Tạo task con (đứng trên feature cha trước)
git checkout develop              # Chuyển sang develop
git branch -d branch-name         # Xóa local branch (đã merge)
git push origin --delete branch   # Xóa remote branch

# === SYNC & UPDATE ===
git fetch origin                  # Cập nhật remote refs (không đổi code local)
git pull origin develop           # Pull + merge develop
git pull --rebase origin <target> # Pull + REBASE lên branch đích (khuyên dùng)
git rebase origin/develop         # Rebase lên develop mới nhất

# === REBASE & CONFLICT ===
git rebase --continue             # Tiếp tục rebase sau khi sửa conflict
git rebase --abort                # Bỏ cuộc rebase, quay về trước rebase
git push --force-with-lease       # Push an toàn sau rebase (KHÔNG dùng --force trần)

# === CHERRY-PICK (mang commit sang branch khác, vd hotfix -> develop) ===
git cherry-pick <hash>            # Lấy 1 commit
git cherry-pick <a>^..<b>         # Lấy 1 dãy commit
git cherry-pick --continue        # Tiếp sau khi sửa conflict
git cherry-pick --abort           # Bỏ cuộc cherry-pick

# === COMMIT & PUSH ===
git add .                         # Stage all (chỉ an toàn khi .gitignore chuẩn)
git add <file>                    # Stage cụ thể (khuyên dùng, tránh dính rác)
git commit -m "type: description" # Commit với conventional message
git push origin feature/name      # Push branch lên remote

# === MERGE & PR & INSPECT ===
git merge feature/name            # Merge feature vào branch hiện tại
git log --oneline --graph         # Xem lịch sử merge dạng cây
git status                        # Xem đang có gì chờ commit
git check-ignore -v <file>        # Hỏi git: file này có bị ignore không?
```

---

## 7. Commit Message Convention

```text
<type>: <mô tả ngắn gọn>

[tùy chọn] body: mô tả chi tiết hơn
[tùy chọn] footer: thông tin issue, PR
```

**Types:**

| Type       | Mô tả                         | Example                                  |
|------------|-------------------------------|------------------------------------------|
| `feat`     | Tính năng mới                 | `feat: add Google OAuth login`           |
| `fix`      | Sửa lỗi                       | `fix: resolve login timeout issue`       |
| `hotfix`   | Sửa lỗi production gấp        | `hotfix: fix login session timeout`      |
| `docs`     | Documentation                 | `docs: update API docs`                  |
| `style`    | Format code (không đổi logic) | `style: format imports`                  |
| `refactor` | Cải thiện code                | `refactor: simplify auth middleware`     |
| `test`     | Tests                         | `test: add auth service tests`           |
| `chore`    | Config, dependencies          | `chore: update dependencies`             |

---

## 8. Git Hooks (Pre-commit)

```text
Pre-commit hooks đã được cấu hình:
  [x] ESLint auto-fix   (staged files)
  [x] Prettier format   (staged files)
  [x] Commit message validation

-> Commit không pass hooks = không cho commit.
```

---

## 9. Lưu Ý Quan Trọng

> ⚠️ **TUYỆT ĐỐI KHÔNG:**
>
> 🚫 `git push origin main` trực tiếp
> 🚫 `git commit` thẳng trên `main` hoặc `develop`
> 🚫 Dùng `--force` trần (luôn dùng `--force-with-lease`)
> 🚫 Force push lên `main` và `develop`
> 🚫 Merge bằng `--no-ff` khi không cần thiết
> 🚫 `git add .` khi `.gitignore` chưa chặn rác AI tool (`.qoder/`, `.github/agents/`…)
> 🚫 Để branch cũ (stale branches) / task đã merge tồn tại quá lâu

> ✅ **LUÔN LUÔN:**
>
> ✅ Rebase branch lên **branch đích** trước khi tạo PR (`develop` hoặc `feature/` cha)
> ✅ Giải quyết conflict **trên máy mình** trước khi bấm Create PR
> ✅ Viết descriptive commit messages theo convention (mục 7)
> ✅ Xóa `task/` sau khi merge vào feature cha; xóa `feature/` sau khi merge vào develop
> ✅ Chạy tests trước khi push
> ✅ Review code của người khác (peer review)