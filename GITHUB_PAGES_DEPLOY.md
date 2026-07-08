# GitHub Pages 公网只读发布说明

这个目录已经支持把平台导出成 GitHub Pages 静态公开版。

## 能实现什么

- 可以获得一个公网链接，例如：
  `https://你的GitHub用户名.github.io/indicator-platform/`
- 微信、电脑浏览器都可以打开。
- 可以查看全市五项指标、各区两项任务、技师专项、人工智能类证书。
- 可以切换结束期数、累计、2021年以来、时间段。
- 可以点击“导出 PDF”，通过浏览器打印/另存为 PDF。

## 不能实现什么

GitHub Pages 只能托管静态网页，不能运行 FastAPI 后端，所以公开版不支持：

- 上传表格
- 删除或修改数据
- 在线写入数据库
- 服务端生成 Word/PDF
- 登录后台管理

管理端仍然在本机或云服务器运行。GitHub Pages 只负责公开只读展示。

## 每次发布前先导出数据

在平台目录执行：

```powershell
cd C:\Users\lvliq\Documents\Codex\2026-05-30\new-chat\outputs\indicator-platform
python scripts\export_github_pages.py
```

这会更新：

```text
docs/data/site-data.json
```

## 首次上传到 GitHub

1. 在 GitHub 新建仓库，例如：

```text
indicator-platform
```

2. 本地执行：

```powershell
cd C:\Users\lvliq\Documents\Codex\2026-05-30\new-chat\outputs\indicator-platform
git init
git add app docs scripts requirements.txt README.md GITHUB_PAGES_DEPLOY.md .gitignore
git commit -m "publish indicator platform readonly page"
git branch -M main
git remote add origin https://github.com/你的GitHub用户名/indicator-platform.git
git push -u origin main
```

## 开启 GitHub Pages

进入 GitHub 仓库：

```text
Settings -> Pages
```

选择：

```text
Source: Deploy from a branch
Branch: main
Folder: /docs
```

保存后，GitHub 会生成访问链接：

```text
https://你的GitHub用户名.github.io/indicator-platform/
```

## 后续每次更新数据

```powershell
cd C:\Users\lvliq\Documents\Codex\2026-05-30\new-chat\outputs\indicator-platform
python scripts\export_github_pages.py
git add docs/data/site-data.json
git commit -m "update public indicator data"
git push
```

## 安全提醒

- `docs/data/site-data.json` 里的数据会公开给所有知道链接的人。
- 如果数据不能公开，不要用 GitHub Pages。
- 数据库 `data/platform.db`、上传表格 `uploads/`、导出报告 `data/reports/` 已经被 `.gitignore` 排除，不要手动加入 GitHub。
