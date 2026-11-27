// Plain stylesheet imports (`import "./globals.css"`) have no exports.
// TypeScript 6 checks side-effect imports by default (noUncheckedSideEffectImports),
// and Next only declares `*.module.css`, so declare plain `.css` here.
declare module "*.css";
