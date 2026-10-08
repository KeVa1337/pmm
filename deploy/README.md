# Архів для хостингу

`site.zip` — лише файли сайту (index.html, styles.css, script.js, assets/), без воркера та документації.
Розпакуйте його в корінь сайту (на Hostinger — папка `public_html`).

Оновити архів після змін:
```
zip -r deploy/site.zip index.html styles.css script.js assets
```
