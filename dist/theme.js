const REQUIRED_COLORS = ['paper', 'ink', 'page', 'accent-lt', 'accent', 'accent-dk', 'strong-lt', 'strong', 'strong-dk'];
// Hand check instead of a schema library: the same rules as theme.schema.json
export function checkTheme(t) {
    const errors = [];
    const th = t;
    if (!th || typeof th !== 'object')
        return ['theme.json non è un oggetto'];
    for (const c of REQUIRED_COLORS)
        if (typeof th.colors?.[c] !== 'string')
            errors.push(`colors.${c} manca`);
    for (const f of ['display', 'title', 'body'])
        if (typeof th.fonts?.[f] !== 'string')
            errors.push(`fonts.${f} manca`);
    if (typeof th.logo !== 'string')
        errors.push('logo manca');
    if (typeof th.logoMono !== 'string')
        errors.push('logoMono manca');
    return errors;
}
// Writes the theme on :root before the first render, so the first paint (and the PDF) is already right
export function applyTheme(t) {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(t.colors))
        root.setProperty(`--color-${k}`, v);
    root.setProperty('--font-display', `'${t.fonts.display}', sans-serif`);
    root.setProperty('--font-title', `'${t.fonts.title}', sans-serif`);
    root.setProperty('--font-body', `'${t.fonts.body}', sans-serif`);
    if (t.radius)
        root.setProperty('--radius', t.radius);
    for (const href of t.fonts.css ?? []) {
        if (document.querySelector(`link[href="${href}"]`))
            continue;
        document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
    }
}
