import { Storage } from "@plasmohq/storage";
import { themeIcons } from "./icons";

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
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    // Helps the browser render built-in controls (scrollbars, form controls) correctly.
    html.style.colorScheme = theme === "dark" ? "dark" : "light";

    // Some CSS is scoped to `.xzzdpro[data-theme=...]` (and popup may not share the same root).
    document.body?.setAttribute("data-theme", theme);
    document
      .querySelectorAll<HTMLElement>(".xzzdpro")
      .forEach((el) => el.setAttribute("data-theme", theme));
    this.updateThemeIcon(theme);
  }

  setup(): void {
    const themeToggleBtn = document.getElementById(this.buttonId);
    const themeIcon = document.querySelector(`.${this.iconClass}`) as HTMLElement;

    if (!themeToggleBtn || !themeIcon) {
      console.warn('XZZDPRO: 主题切换按钮未找到');
      return;
    }

    // 初始化图标
    const fallbackTheme =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    this.applyTheme(fallbackTheme);

    this.storage.get('theme').then((currentTheme) => {
      const theme = (currentTheme || fallbackTheme) as string;
      this.applyTheme(theme);
    });

    // 监听storage变化
    this.storage.watch({
      theme: (change) => {
        this.applyTheme(change.newValue || 'light');
      }
    });

    // 绑定点击事件
    themeToggleBtn.addEventListener('click', async () => {
      const currentTheme = await this.storage.get('theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      // 保存到storage
      await this.storage.set('theme', newTheme);
      this.applyTheme(newTheme);

      console.log(`XZZDPRO: 主题已切换至 ${newTheme}`);
    });
  }

  mount(container: HTMLElement, className: string = 'icon-btn', title: string = '切换主题'): void {
    container.innerHTML += this.renderHTML(className, title);
    this.setup();
  }
}

export function createThemeToggle(buttonId?: string, iconClass?: string): ThemeToggle {
  return new ThemeToggle(buttonId, iconClass);
}
