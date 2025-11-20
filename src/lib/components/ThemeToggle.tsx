import { Storage } from "@plasmohq/storage";

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
        <span class="${this.iconClass}">🌙</span>
      </button>
    `;
  }

  private updateThemeIcon(theme: string): void {
    const themeIcon = document.querySelector(`.${this.iconClass}`) as HTMLElement;
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  setup(): void {
    const themeToggleBtn = document.getElementById(this.buttonId);
    const themeIcon = document.querySelector(`.${this.iconClass}`) as HTMLElement;

    if (!themeToggleBtn || !themeIcon) {
      console.warn('XZZDPRO: 主题切换按钮未找到');
      return;
    }

    // 初始化图标
    this.storage.get('theme').then((currentTheme) => {
      const theme = currentTheme || 'light';
      this.updateThemeIcon(theme);
    });

    // 监听storage变化
    this.storage.watch({
      theme: (change) => {
        this.updateThemeIcon(change.newValue || 'light');
      }
    });

    // 绑定点击事件
    themeToggleBtn.addEventListener('click', async () => {
      const currentTheme = await this.storage.get('theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      // 保存到storage
      await this.storage.set('theme', newTheme);
      this.updateThemeIcon(newTheme);

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
