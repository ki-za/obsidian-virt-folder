import { App, PluginSettingTab, Setting, TextAreaComponent, TextComponent, DropdownComponent, ToggleComponent } from 'obsidian';
import VirtFolderPlugin  from './main';
import { InputPromptModal } from './input_prompt_modal';

export enum SortTypes
{
    file_name = "file_name",
    note_title = "note_title",
	creation_time = "creation_time",
	modification_time = "modification_time",
};

export interface ColorMapping
{
	pattern: string;
	color: string;
	opacity: number;
}

export interface TagHighlightConfig
{
	tag: string;
	color: string;
	opacity: number;
}

export interface HighlightProp
{
	prop: string;
	color: string;
	opacity: number;
}

export interface VirtFolderSettings
{
	ignorePath: string;
	ignoreTags: string;
	propertyName: string;
	titleProp: string;
	iconProp: string;
	cmdShowTitle: boolean;
	sortTreeBy: SortTypes;
	sortTreeRev: boolean;
	UseWikiLinks: boolean;
	confirmDelete: boolean;
	autoReveal: boolean;
	firstRun: boolean;
	tagHighlights: TagHighlightConfig[];
	highlightProps: HighlightProp[];
}

export const DEFAULT_SETTINGS: Partial<VirtFolderSettings> =
{
	ignorePath: '',
	ignoreTags: '',
	propertyName: 'Folders',
	titleProp: '',
	iconProp: 'vf_icon',
	cmdShowTitle: false,
	sortTreeBy: SortTypes.file_name,
	sortTreeRev: false,
	UseWikiLinks: true,
	confirmDelete: true,
	autoReveal: false,
	firstRun: true,
	tagHighlights: [],
	highlightProps: [{ prop: "tags", color: "#ff6b6b", opacity: 0.3 }],
};

export class VirtFolderSettingTab extends PluginSettingTab
{
	plugin: VirtFolderPlugin;
	counter: TextComponent;

	constructor(app: App, plugin: VirtFolderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.init_settings();
	}

	init_settings()
	{
		this.update_filter(this.plugin.settings.ignorePath);
		this.update_ignored_tags(this.plugin.settings.ignoreTags);
		this.update_prop_name(this.plugin.settings.propertyName);
		this.update_title(this.plugin.settings.titleProp);
		this.update_icon_prop(this.plugin.settings.iconProp);
	}

	display(): void
	{
		let { containerEl } = this;
		containerEl.empty();
	
		// validate on change !!

		new Setting(containerEl)
		.setName("YAML for  note's folders")
		.setDesc("The name can contain letters, numbers, minus sign, underscore and dots")
		.addText((text: TextComponent) =>
		{
			text.setValue(this.plugin.settings.propertyName);
			text.setPlaceholder('Folders')
			text.onChange(async (value) =>
			{
				let style = text.inputEl.style;

				if(this.is_valid_prop_name(value))
				{
					style.borderColor = '';

					this.plugin.settings.propertyName = value;
					await this.plugin.saveSettings();

					this.update_prop_name(value);
				}else{
					style.borderColor = this.get_css_var('--background-modifier-error');
				}
			});
		});


		// can be empty !!!

		new Setting(containerEl)
		.setName("YAML for note's title")
		.setDesc("Leave the field blank to take the title from the file name. Case-sensitive")
		.addText((text: TextComponent) =>
		{
			text.setValue(this.plugin.settings.titleProp);
			text.setPlaceholder('Title')
			text.onChange(async (value) =>
			{
				let style = text.inputEl.style;

				if(this.is_empty_str(value) || this.is_valid_prop_name(value))
				{
					style.borderColor = '';

					this.plugin.settings.titleProp = value;
					await this.plugin.saveSettings();

					this.update_title(value);
				}else{
					style.borderColor = this.get_css_var('--background-modifier-error');
				}
			});
		});


		new Setting(containerEl)
		.setName("YAML for note's icon")
		.setDesc("The name can contain letters, numbers, minus sign, underscore and dots")
		.addText((text: TextComponent) =>
		{
			text.setValue(this.plugin.settings.iconProp);
			text.setPlaceholder('vf_icon')
			text.onChange(async (value) =>
			{
				let style = text.inputEl.style;

				if(this.is_valid_prop_name(value))
				{
					style.borderColor = '';

					this.plugin.settings.iconProp = value;
					await this.plugin.saveSettings();

					this.update_icon_prop(value);
				}else{
					style.borderColor = this.get_css_var('--background-modifier-error');
				}
			});
		});


		new Setting(containerEl)
		.setName("Use title in commands")
		.setDesc("Display note's title instead of file name when displaying command results")
		.addToggle( (tg:ToggleComponent) =>
		{
			tg.setValue(this.plugin.settings.cmdShowTitle);
			tg.onChange(async (value) =>
			{
				this.plugin.settings.cmdShowTitle = value;
				await this.plugin.saveSettings();
			});
		});


		new Setting(containerEl)
		.setName("Sorting")
		.setDesc("Note sorting criteria in the tree view")
		.addDropdown( (dc:DropdownComponent) =>
		{
			for(let key of Object.keys(SortTypes))
			{
				dc.addOption(key, key);
			}

			dc.setValue(this.plugin.settings.sortTreeBy);
			
			dc.onChange(async (value) =>
			{
				this.plugin.settings.sortTreeBy = SortTypes[value as keyof typeof SortTypes];
				await this.plugin.saveSettings();
				this.update_note_list();
			});
		});
		

		new Setting(containerEl)
		.setName("Reverse sort order")
		.addToggle( (tg:ToggleComponent) =>
		{
			tg.setValue(this.plugin.settings.sortTreeRev);
			tg.onChange(async (value) =>
			{
				this.plugin.settings.sortTreeRev = value;
				await this.plugin.saveSettings();
				this.update_note_list();
			});
		});

		
		new Setting(containerEl)
		.setName("List of ignored paths")
		.setDesc("Each line is interpreted as the start of an ignored path")
		.addTextArea((textArea: TextAreaComponent) =>
		{
			textArea
				.setValue(this.plugin.settings.ignorePath)
				.setPlaceholder('Enter one or more paths relative to the archive root')
				.onChange(async (value) =>
				{
					this.plugin.settings.ignorePath = value;
					await this.plugin.saveSettings();

					this.update_filter(value);
					this.update_counter();
					this.update_note_list();
				});

			textArea.inputEl.setAttr("rows", 6);
			textArea.inputEl.setAttr("cols", 40);
		});


		new Setting(containerEl)
		.setName("List of ignored tags")
		.setDesc("Notes with any of these tags will be hidden from the tree. One tag per line, # is optional")
		.addTextArea((textArea: TextAreaComponent) =>
		{
			textArea
				.setValue(this.plugin.settings.ignoreTags)
				.setPlaceholder('fleeting\n#daily')
				.onChange(async (value) =>
				{
					this.plugin.settings.ignoreTags = value;
					await this.plugin.saveSettings();

					this.update_ignored_tags(value);
					this.update_counter();
					this.update_note_list();
				});

			textArea.inputEl.setAttr("rows", 4);
			textArea.inputEl.setAttr("cols", 40);
		});


		new Setting(containerEl)
		.setName("Ignored files")
		.addText((text: TextComponent) =>
		{
			text.setValue('0').setDisabled(true);
			this.counter = text;
		});

		this.update_counter();


		new Setting(containerEl)
		.setName("Use [[WikiLinks]] in YAML")
		.addToggle( (tg:ToggleComponent) =>
		{
			tg.setValue(this.plugin.settings.UseWikiLinks);
			tg.onChange(async (value) =>
			{
				this.plugin.settings.UseWikiLinks = value;
				await this.plugin.saveSettings();
				this.update_note_list();
			});
		});


		new Setting(containerEl)
		.setName("Confirm before deleting")
		.setDesc("Show confirmation dialog before deleting a note")
		.addToggle( (tg:ToggleComponent) =>
		{
			tg.setValue(this.plugin.settings.confirmDelete);
			tg.onChange(async (value) =>
			{
				this.plugin.settings.confirmDelete = value;
				await this.plugin.saveSettings();
			});
		});


		new Setting(containerEl)
		.setName("Auto reveal active file")
		.setDesc("Automatically reveal the active file in the tree when opening any file")
		.addToggle( (tg:ToggleComponent) =>
		{
			tg.setValue(this.plugin.settings.autoReveal);
			tg.onChange(async (value) =>
			{
				this.plugin.settings.autoReveal = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
			.setName('Tag highlighting')
			.setHeading();

		new Setting(containerEl)
			.setName('Add tag')
			.setDesc('Add a tag to highlight in the tree view')
			.addButton(btn => {
				btn.setIcon('plus')
					.setTooltip('Add new tag')
					.onClick(() => this.showAddTagModal());
			});

		const tagHighlights = this.plugin.settings.tagHighlights || [];
		tagHighlights.forEach((config, index) => {
			new Setting(containerEl)
				.setName(config.tag)
				.addColorPicker(cp => {
					cp.setValue(config.color);
					cp.onChange(async (value) => {
						this.plugin.settings.tagHighlights[index].color = value;
						await this.plugin.saveSettings();
						this.update_note_list();
					});
				})
				.addSlider(slider => {
					slider.setValue(config.opacity * 100)
						.setLimits(10, 100, 5)
						.setDynamicTooltip();
					slider.onChange(async (value) => {
						this.plugin.settings.tagHighlights[index].opacity = value / 100;
						await this.plugin.saveSettings();
						this.update_note_list();
					});
				})
				.addButton(btn => {
					btn.setIcon('trash')
						.onClick(() => {
							this.plugin.settings.tagHighlights.splice(index, 1);
							this.plugin.saveSettings();
							this.display();
							this.update_note_list();
						});
				});
		});

	}

	update_counter()
	{
		let count = this.plugin.base.get_filtered_count();
		this.counter.setValue(count.toString());
	}

	update_note_list()
	{
		this.plugin.base.rescan();
		this.plugin.update_data();
	}
	
	update_filter(value:string)
	{
		let filter = this.parse_text_area(value);
		this.plugin.base.settings.set_filter(filter);
	}

	update_ignored_tags(value:string)
	{
		let tags = this.parse_text_area(value).map(t => t.startsWith('#') ? t : '#' + t);
		this.plugin.base.settings.set_ignored_tags(tags);
	}

	parse_text_area(value:string)
	{
		return value.split(/\r|\n/).map(n => n.trim()).filter(n=>n);
	}

	is_empty_str(name:string): boolean
	{
		return name === '';
	}

	is_valid_prop_name(name:string): boolean
	{
		let regexp = /^[\p{L}\p{N}_.-]+$/u;
		return regexp.test(name);
	}

	update_prop_name(name:string)
	{
		if (!this.is_valid_prop_name(name))	return;
		this.plugin.base.settings.set_prop(name);
		this.update_note_list();
	}

	update_title(value:string)
	{
		if (this.is_empty_str(value) || this.is_valid_prop_name(value))
		{
			this.plugin.base.settings.set_title(value);
			this.update_note_list();
		}
	}

	update_icon_prop(value:string)
	{
		if (this.is_valid_prop_name(value))
		{
			this.plugin.base.settings.set_icon_prop(value);
			this.update_note_list();
		}
	}

	get_css_var(variable:string)
	{
		let el = document.querySelector('body');
		if (!el) return '';

		let style = window.getComputedStyle(el);
		if (!style) return '';

		return style.getPropertyValue(variable);
	}

	parseColorMappings(value: string): ColorMapping[]
	{
		const result: ColorMapping[] = [];
		const lines = value.split(/\r|\n/).map(n => n.trim()).filter(n => n);

		for (const line of lines)
		{
			const parts = line.split(/\s+/);
			if (parts.length < 3) continue;

			const pattern = parts[0];
			const color = parts[1];
			const opacity = parseInt(parts[2], 10);

			if (opacity >= 0 && opacity <= 100)
			{
				result.push({ pattern, color, opacity });
			}
		}

		return result;
	}

	serializeColorMappings(mappings: ColorMapping[]): string
	{
		return mappings.map(m => `${m.pattern} ${m.color} ${m.opacity}`).join('\n');
	}

	showAddTagModal(): void
	{
		new InputPromptModal(
			this.app,
			'Tag name:',
			'e.g., #work, #urgent',
			async (value) => {
				if (!value) return;
				let tag = value.startsWith('#') ? value : '#' + value;
				if (!/^#[a-zA-Z0-9._-]+$/.test(tag)) return;

				this.plugin.settings.tagHighlights.push({
					tag: tag,
					color: '#ff6b6b',
					opacity: 0.3
				});
				await this.plugin.saveSettings();
				this.display();
				this.update_note_list();
			}
		).open();
	}
}