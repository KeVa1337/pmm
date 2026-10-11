# Архів для хостингу

`site.zip` — лише файли сайту (index.html, privacy.html, styles.css, script.js, assets/, robots.txt, sitemap.xml, feed.xml), без воркера та документації.
Розпакуйте його в корінь сайту (на Hostinger — папка `public_html`).

Оновити архів після змін:
```
zip -r deploy/site.zip index.html privacy.html styles.css script.js assets robots.txt sitemap.xml feed.xml
```

Після змін у styles.css чи script.js змініть `?v=...` в index.html, щоб браузери не брали старі файли з кешу.
