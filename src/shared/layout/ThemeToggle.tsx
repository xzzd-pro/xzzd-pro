import { Storage } from "@plasmohq/storage";
import { themeIcons } from "./icons";
import { applyThemeToDocument, getFallbackTheme, normalizeTheme } from "@/lib/themeDom";
import { bindLayoutControl } from "./bindings";

export class ThemeToggle {
  private storage: Storage;
  private buttonId: string;
  private iconClass: string;

  constructor(buttonId: string = 'theme-toggle-btn', iconClass: string = 'theme-icon') {
    this.storage = new Storage();
    this.buttonId = buttonId;
    this.iconClass = iconClass;
  }

  renderHTML(className: string = 'icon-btn', title: string = '切换主题'): string {
    return `
      <button id="${this.buttonId}" class="${className}" title="${title}">
        <span class="${this.iconClass}">${themeIcons.moon}</span>
      </button>
    `;
  }

  private updateThemeIcon(theme: string): void {
    const themeIcon = document.querySelector(`.${this.iconClass}`) as HTMLElement;
    if (themeIcon) {
      themeIcon.innerHTML = theme === 'dark' ? themeIcons.sun : themeIcons.moon;
    }
  }

  private applyTheme(theme: string): void {
    applyThemeToDocument(normalizeTheme(theme));
    this.updateThemeIcon(theme);
  }

  setup(): void {
    const themeToggleBtn = document.getElementById(this.buttonId);
    const themeIcon = document.querySelector(`.${this.iconClass}`) as HTMLElement;

    if (!themeToggleBtn || !themeIcon) {
      console.warn('XZZDPRO: 主题切换按钮未找到');
      return;
    }
    const binding = bindLayoutControl(`theme:${this.buttonId}`, themeToggleBtn);
    if (!binding) return;
    const { signal } = binding;

    // 初始化图标
    const fallbackTheme = getFallbackTheme();
    this.applyTheme(fallbackTheme);

    this.storage.get('theme').then((currentTheme) => {
      if (signal.aborted || !themeToggleBtn.isConnected) return;
      const theme = (currentTheme || fallbackTheme) as string;
      this.applyTheme(theme);
    }).catch(error => console.warn('XZZDPRO: Failed to load theme', error));

    // 监听storage变化
    const callbacks = {
      theme: (change: { newValue?: string }) => {
        if (signal.aborted || !themeToggleBtn.isConnected) return;
        this.applyTheme(change.newValue || 'light');
      }
    };
    this.storage.watch(callbacks);
    binding.onCleanup(() => this.storage.unwatch(callbacks));

    // 绑定点击事件
    themeToggleBtn.addEventListener('click', async () => {
      try {
        const currentTheme = await this.storage.get('theme') || 'light';
        if (signal.aborted || !themeToggleBtn.isConnected) return;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        // 保存到storage
        await this.storage.set('theme', newTheme);
        if (signal.aborted || !themeToggleBtn.isConnected) return;
        this.applyTheme(newTheme);

        console.log(`XZZDPRO: 主题已切换至 ${newTheme}`);
      } catch (error) {
        console.error('XZZDPRO: Failed to save theme', error);
      }
    }, { signal });
  }

  mount(container: HTMLElement, className: string = 'icon-btn', title: string = '切换主题'): void {
    container.innerHTML += this.renderHTML(className, title);
    this.setup();
  }
}

export function createThemeToggle(buttonId?: string, iconClass?: string): ThemeToggle {
  return new ThemeToggle(buttonId, iconClass);
}
