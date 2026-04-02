import { App, Modal, TextComponent, Setting } from "obsidian";

export class InputPromptModal extends Modal {
  private submitted = false;
  private inputEl: HTMLInputElement;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor(
    app: App,
    private title: string,
    private placeholder: string,
    private onSubmit: (value: string) => void,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText(this.title);

    const input = new TextComponent(contentEl)
      .setPlaceholder(this.placeholder)
      .setValue("");

    this.inputEl = input.inputEl;
    input.inputEl.select();

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !this.submitted) {
        this.submitted = true;
        this.onSubmit(input.getValue());
        this.close();
      }
    };

    this.inputEl.addEventListener("keydown", this.keydownHandler);

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Add").onClick(() => {
          if (this.submitted) return;
          this.submitted = true;
          this.onSubmit(input.getValue());
          this.close();
        }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.close();
        }),
      );
  }

  onClose() {
    this.submitted = false;
    if (this.inputEl) {
      this.inputEl.removeEventListener("keydown", this.keydownHandler);
    }
  }
}
