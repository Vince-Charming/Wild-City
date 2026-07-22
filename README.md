# Tailwind production build for commonwildcincy.org

Your site currently loads Tailwind from the CDN (`<script src="https://cdn.tailwindcss.com">`),
which ships the entire framework, unminified, to every visitor. This folder compiles a
CSS file containing only the classes your site actually uses.

## One-time setup

1. Install Node.js if you don't have it: https://nodejs.org (LTS version)
2. Copy `package.json` and `tailwind.config.js` from this folder into the root of
   your site (the same folder as index.html, about.html, etc.)
3. Create a `src/input.css` file there with the contents of `input.css` in this folder
4. From that root folder, run:

   npm install
   npm run build

   This creates `dist/output.css` -- a small, minified CSS file.

## Switch each HTML file over

In every one of the 5 HTML files, replace this line:

   <script src="https://cdn.tailwindcss.com"></script>
   <script> tailwind.config = { ... } </script>

with just:

   <link rel="stylesheet" href="dist/output.css">

(You can delete the `tailwind.config = {...}` script block entirely once you switch --
its settings now live in `tailwind.config.js` and are baked into output.css.)

## Ongoing development

Whenever you change class names in your HTML, run `npm run build` again (or run
`npm run watch` while you work, and it rebuilds automatically on save).
