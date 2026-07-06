export type ThemeMode = 'light' | 'dark';

const sharedTokens = {
  font: {
    family: {
      sans: '"Aptos", "Aptos Display", "Segoe UI Variable", "Helvetica Neue", sans-serif'
    }
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px'
  },
  radius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '16px',
    pill: '999px'
  },
  type: {
    body: '0.94rem',
    meta: '0.82rem',
    label: '0.74rem',
    title: '1.12rem'
  }
} as const;

const lightTheme = {
  colorScheme: 'light',
  surface: {
    page: {
      base: '#f4f1eb',
      start: '#fffdf9',
      glow: 'rgba(62, 90, 138, 0.07)'
    },
    card: {
      base: 'color-mix(in srgb, #ffffff 95%, #fcfaf7 5%)',
      border: 'rgba(221, 228, 238, 0.95)'
    },
    control: {
      base: 'rgba(255, 255, 255, 0.98)',
      muted: 'rgba(255, 255, 255, 0.92)',
      insetHighlight: 'rgba(255, 255, 255, 0.8)'
    },
    frosted: {
      base: 'rgba(255, 255, 255, 0.82)',
      border: 'rgba(221, 228, 238, 0.98)',
      shadow: '0 6px 18px rgba(16, 24, 40, 0.06)'
    },
    emphasis: {
      base: 'linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(252, 248, 242, 0.98) 100%)',
      stale: 'linear-gradient(180deg, rgba(255, 247, 244, 0.98) 0%, rgba(254, 243, 238, 0.98) 100%)',
      border: 'rgba(214, 199, 182, 0.96)',
      borderStrong: 'rgba(214, 199, 182, 0.75)',
      shadow: '0 4px 12px rgba(62, 90, 138, 0.045)'
    },
    panel: {
      base: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 247, 243, 0.98) 100%)',
      glow: 'rgba(62, 90, 138, 0.1)',
      shadow: '14px 0 32px rgba(16, 24, 40, 0.08)',
      shadowMobile: '-14px 0 32px rgba(16, 24, 40, 0.08)'
    },
    selected: 'rgba(232, 239, 249, 0.92)',
    success: 'rgba(235, 248, 239, 0.98)',
    info: 'rgba(231, 242, 255, 0.96)',
    warning: 'rgba(255, 244, 229, 0.96)',
    danger: 'rgba(255, 247, 244, 0.95)'
  },
  text: {
    primary: '#182535',
    secondary: '#475467',
    muted: '#667085',
    accent: '#2e4467',
    info: '#0b5394',
    success: '#166534',
    warning: '#9a5b00',
    onAccent: '#f8fafc'
  },
  border: {
    subtle: '#dde4ee',
    strong: '#cfd8e4',
    info: 'rgba(176, 212, 255, 0.96)',
    success: 'rgba(167, 243, 208, 0.98)',
    warning: 'rgba(255, 212, 153, 0.96)',
    danger: 'rgba(191, 90, 51, 0.22)',
    accent: 'rgba(62, 90, 138, 0.18)'
  },
  accent: {
    base: '#3e5a8a',
    strong: '#2e4467',
    soft: '#4a6ba0',
    warm: 'rgba(198, 127, 35, 0.78)',
    warmSoft: 'rgba(198, 127, 35, 0.44)',
    coolSoft: 'rgba(11, 83, 148, 0.68)'
  },
  button: {
    primary: {
      background: 'linear-gradient(180deg, #4a6ba0 0%, #2e4467 100%)',
      backgroundDisabled: 'linear-gradient(180deg, rgba(104, 131, 173, 0.9) 0%, rgba(60, 85, 122, 0.92) 100%)',
      shadow: '0 4px 12px rgba(62, 90, 138, 0.16)',
      shadowDisabled: '0 3px 10px rgba(62, 90, 138, 0.12)'
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.96)',
      shadow: '0 1px 3px rgba(16, 24, 40, 0.03)'
    }
  },
  focus: {
    ring: '0 0 0 4px rgba(62, 90, 138, 0.14)'
  },
  shadow: {
    base: '0 12px 32px rgba(16, 24, 40, 0.06)',
    soft: '0 3px 12px rgba(16, 24, 40, 0.045)'
  }
} as const;

const darkTheme = {
  colorScheme: 'dark',
  surface: {
    page: {
      base: '#11161d',
      start: '#161d27',
      glow: 'rgba(112, 146, 205, 0.12)'
    },
    card: {
      base: 'color-mix(in srgb, #1b2430 94%, #131922 6%)',
      border: 'rgba(80, 96, 120, 0.72)'
    },
    control: {
      base: 'rgba(28, 36, 48, 0.98)',
      muted: 'rgba(24, 31, 41, 0.94)',
      insetHighlight: 'rgba(255, 255, 255, 0.04)'
    },
    frosted: {
      base: 'rgba(20, 26, 35, 0.84)',
      border: 'rgba(88, 104, 130, 0.78)',
      shadow: '0 8px 22px rgba(0, 0, 0, 0.28)'
    },
    emphasis: {
      base: 'linear-gradient(180deg, rgba(40, 49, 61, 0.98) 0%, rgba(29, 36, 47, 0.98) 100%)',
      stale: 'linear-gradient(180deg, rgba(62, 37, 34, 0.98) 0%, rgba(48, 31, 29, 0.98) 100%)',
      border: 'rgba(118, 104, 87, 0.72)',
      borderStrong: 'rgba(118, 104, 87, 0.52)',
      shadow: '0 4px 12px rgba(0, 0, 0, 0.18)'
    },
    panel: {
      base: 'linear-gradient(180deg, rgba(28, 36, 48, 0.98) 0%, rgba(20, 27, 37, 0.98) 100%)',
      glow: 'rgba(112, 146, 205, 0.16)',
      shadow: '14px 0 32px rgba(0, 0, 0, 0.26)',
      shadowMobile: '-14px 0 32px rgba(0, 0, 0, 0.26)'
    },
    selected: 'rgba(54, 71, 97, 0.96)',
    success: 'rgba(24, 52, 41, 0.96)',
    info: 'rgba(19, 49, 80, 0.96)',
    warning: 'rgba(74, 50, 20, 0.96)',
    danger: 'rgba(68, 30, 30, 0.96)'
  },
  text: {
    primary: '#e7edf5',
    secondary: '#c2cfdd',
    muted: '#9fb0c4',
    accent: '#c9d8f0',
    info: '#9cc9ff',
    success: '#8bdbb1',
    warning: '#f4c980',
    onAccent: '#f5f8fc'
  },
  border: {
    subtle: '#4c5c72',
    strong: '#647690',
    info: 'rgba(82, 132, 189, 0.96)',
    success: 'rgba(58, 127, 86, 0.96)',
    warning: 'rgba(166, 119, 39, 0.96)',
    danger: 'rgba(145, 70, 70, 0.68)',
    accent: 'rgba(112, 146, 205, 0.3)'
  },
  accent: {
    base: '#7092cd',
    strong: '#9db6de',
    soft: '#88a7d7',
    warm: 'rgba(214, 160, 84, 0.86)',
    warmSoft: 'rgba(214, 160, 84, 0.46)',
    coolSoft: 'rgba(108, 167, 232, 0.72)'
  },
  button: {
    primary: {
      background: 'linear-gradient(180deg, #88a7d7 0%, #5a76a2 100%)',
      backgroundDisabled: 'linear-gradient(180deg, rgba(104, 131, 173, 0.72) 0%, rgba(60, 85, 122, 0.8) 100%)',
      shadow: '0 4px 12px rgba(0, 0, 0, 0.22)',
      shadowDisabled: '0 3px 10px rgba(0, 0, 0, 0.16)'
    },
    secondary: {
      background: 'rgba(27, 35, 46, 0.96)',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.14)'
    }
  },
  focus: {
    ring: '0 0 0 4px rgba(112, 146, 205, 0.24)'
  },
  shadow: {
    base: '0 12px 32px rgba(0, 0, 0, 0.22)',
    soft: '0 3px 12px rgba(0, 0, 0, 0.16)'
  }
} as const;

export const designTokens = {
  shared: sharedTokens,
  themes: {
    light: lightTheme,
    dark: darkTheme
  }
} as const;

interface TokenTree {
  [key: string]: string | TokenTree;
}

function camelToKebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function flattenTokenTree(tree: TokenTree, prefix = '') {
  return Object.entries(tree).reduce<Record<string, string>>((accumulator, [key, value]) => {
    const nextPrefix = prefix ? `${prefix}-${camelToKebab(key)}` : camelToKebab(key);

    if (typeof value === 'string') {
      accumulator[`--${nextPrefix}`] = value;
      return accumulator;
    }

    Object.assign(accumulator, flattenTokenTree(value, nextPrefix));
    return accumulator;
  }, {});
}

function buildLegacyAliases(mode: ThemeMode): Record<string, string> {
  return {
    '--bg': 'var(--surface-page-base)',
    '--paper': mode === 'light' ? '#ffffff' : '#1b2430',
    '--paper-soft': mode === 'light' ? '#fcfaf7' : '#131922',
    '--ink': 'var(--text-primary)',
    '--muted': 'var(--text-muted)',
    '--line': 'var(--border-subtle)',
    '--line-strong': 'var(--border-strong)',
    '--pill': mode === 'light' ? 'rgba(238, 242, 248, 0.96)' : 'rgba(36, 48, 64, 0.96)',
    '--pill-strong': mode === 'light' ? 'rgba(222, 231, 244, 0.96)' : 'rgba(46, 61, 82, 0.96)',
    '--surface-card': 'var(--surface-card-base)',
    '--surface-control': 'var(--surface-control-base)',
    '--surface-frosted': 'var(--surface-frosted-base)',
    '--surface-emphasis': 'var(--surface-emphasis-base)',
    '--surface-panel': 'var(--surface-panel-base)',
    '--button-primary-bg': 'var(--button-primary-background)',
    '--button-primary-bg-disabled': 'var(--button-primary-background-disabled)',
    '--button-secondary-bg': 'var(--button-secondary-background)'
  };
}

export function getThemeTokens(mode: ThemeMode) {
  return {
    shared: designTokens.shared,
    theme: designTokens.themes[mode]
  } as const;
}

export function getThemeCssVariables(mode: ThemeMode) {
  const tokens = getThemeTokens(mode);

  return {
    ...flattenTokenTree(tokens.shared as unknown as TokenTree),
    ...flattenTokenTree(tokens.theme as unknown as TokenTree),
    ...buildLegacyAliases(mode)
  };
}

export function applyTheme(mode: ThemeMode, root: HTMLElement = document.documentElement) {
  root.dataset.theme = mode;
  root.style.colorScheme = designTokens.themes[mode].colorScheme;

  for (const [name, value] of Object.entries(getThemeCssVariables(mode))) {
    root.style.setProperty(name, value);
  }
}

export function resolveInitialTheme(): ThemeMode {
  const currentTheme = document.documentElement.dataset.theme;

  if (currentTheme === 'light' || currentTheme === 'dark') {
    return currentTheme;
  }

  return 'light';
}
