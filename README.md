# ND 情绪测试问卷

这是一个静态 HTML 问卷网站，已配置为 Netlify Forms。

## 文件

- `index.html`: 问卷页面和 Netlify Forms 表单字段
- `app.js`: 逐页问卷交互、必填校验、时间轴评分、最终提交
- `styles.css`: 页面样式
- `success.html`: Netlify 表单提交成功后的页面
- `netlify.toml`: Netlify 静态部署配置

## 部署到 Netlify

1. 将本文件夹上传到 GitHub 仓库。
2. 在 Netlify 中新建站点并连接该 GitHub 仓库。
3. Build command 留空。
4. Publish directory 使用 `.`。
5. 部署完成后，打开 Netlify 分配的公开网址进行测试。
6. 在 Netlify 的 Forms 页面确认 `eeg-emotion-assessment` 表单已被识别。

## 导出 CSV

被试点击最后一页 `Submit` 后，数据会提交到 Netlify Forms。

在 Netlify 后台进入：

`Site -> Forms -> eeg-emotion-assessment -> Download as CSV`

即可下载所有问卷提交数据。
