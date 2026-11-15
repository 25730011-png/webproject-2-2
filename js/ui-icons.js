// One outline icon family. Decorative SVGs inherit currentColor; controls supply labels.
const UI_ICON_NAMES = new Set(["home", "book", "feed", "trophy", "user", "heart", "vote", "star", "trash", "plus", "close", "chevron-left", "chevron-right", "chevron-up", "chevron-down", "document", "fridge", "check", "circle"]);
function uiIcon(name, filled = false) {
  if (!UI_ICON_NAMES.has(name)) return '';
  return `<svg class="ui-icon${filled ? ' is-filled' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ui-${name}"></use></svg>`;
}
function uiCategory(value) { return ({ '국&찌개': '국·찌개', '일품': '일품요리' })[value] || value; }
