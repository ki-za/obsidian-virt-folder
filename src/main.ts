import { TAbstractFile, Plugin, TFile, Notice, Modal, Setting } from 'obsidian';
import { WorkspaceLeaf } from "obsidian";
import { data, active_id } from './components/stores';
import { NoteData } from './data';
import { BaseScanner } from 'base_scanner';
import { VF_SelectFile } from './select_file_modal';
import { VF_SelectPropModal  } from './select_prop_modal';
import { VIEW_TYPE_VF, VirtFolderView as VirtFolderView } from 'tree_view';
import { YamlParser } from 'yaml_parser';
import { VirtFolderSettingTab, VirtFolderSettings, DEFAULT_SETTINGS } from 'settings';

export default class VirtFolderPlugin extends Plugin
{
	data: NoteData;
	base: BaseScanner;
	yaml: YamlParser;
	settings: VirtFolderSettings;
	
	async onload()
	{
		await this.loadSettings(); // order is important

		this.base = new BaseScanner(this.app, this);
		this.data = new NoteData(this.base);
		this.yaml = new YamlParser(this.app, this);

		this.addSettingTab(new VirtFolderSettingTab(this.app, this));

		this.registerView(
			VIEW_TYPE_VF,
			(leaf) => new VirtFolderView(leaf, this)
		  );

		// add cmd - pin folder (icon='folder-heart')

		this.addCommand({
			id: "open_tree_view",
			name: "Show tree",
			icon: "folder-tree",
			callback: () => {
			  this.VF_OpenTreeView();
			},
		});
 
		this.addCommand({
			id: "add_folder",
			name: "Add folder",
			icon: "folder-plus",
			callback: () => {
				this.VF_AddFolder();
			},
		});

		this.addCommand({
			id: "replace_folder",
			name: "Move folder",
			icon: "folder-output",
			callback: () => {
				this.VF_MoveFolder();
			},
		});

		this.addCommand({
			id: "remove_folder",
			name: "Delete folder",
			icon: "folder-minus",
			callback: () => {
				this.VF_RemoveFolder();
			},
		});

		this.addCommand({
			id: "reveal_active_file",
			name: "Reveal file",
			icon: "folder-search-2",
			callback: () => {
			  this.VF_RevealActiveFile();
			},
		});

		this.app.workspace.onLayoutReady(() => 
		{
			// reactive
			this.data.onStartApp();
			this.update_data();

			this.registerEvent(this.app.metadataCache.on("resolve", this.onResolveMetadata));
			this.registerEvent(this.app.workspace.on("file-open", this.onOpenFile, this));
			this.registerEvent(this.app.vault.on("create", this.onCreateFile));
			this.registerEvent(this.app.vault.on("delete", this.onDeleteFile));
			this.registerEvent(this.app.vault.on("rename", this.onRenameFile));
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateActiveFile()
	{
		let file = this.app.workspace.getActiveFile();
		if(file) active_id.set(file.path);
		else active_id.set('');
	}

	setActiveFile(file: TFile | null)
	{
		if(file instanceof TFile)
		{
			active_id.set(file.path);
		}else{
			active_id.set('');
		}
	}

	update_data()
	{
		data.set(this.base);
		this.updateActiveFile();
	}

	onOpenFile = (file: TFile | null) => 
	{
		this.setActiveFile(file);
	};
	
	onCreateFile = (file: TAbstractFile) => 
	{
		if(file instanceof TFile)
		{
			this.data.onCreate(file);
			this.update_data();
		}
	};
	
	onDeleteFile = (file: TAbstractFile) =>
	{
		// file can be TFolder or TFile
		if(file instanceof TFile)
		{
			this.data.onDelete(file);
			this.update_data();
		}
	};
	
	onRenameFile = (file: TAbstractFile, oldPath: string) =>
	{
		if(file instanceof TFile)
		{
			this.data.onRename(file, oldPath);
			this.update_data();
		}
	};
	  
	onResolveMetadata = (file: TFile) =>
	{
		this.data.onChange(file);
		this.update_data();
	};

	revealFile(path: string[])
	{
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_VF))
		{
			if (!(leaf.view instanceof VirtFolderView)) continue;
			leaf.view.component.focusTo(path);
		}
	}

	async activateView()
	{
		const { workspace } = this.app;
	
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_VF);
	
		if (leaves.length > 0) {
		  // A leaf with our view already exists, use that
		  leaf = leaves[0];
		} else {
		  // Our view could not be found in the workspace, create a new leaf
		  // in the right sidebar for it
		  leaf = workspace.getLeftLeaf(false);
		  if (leaf) await leaf.setViewState({ type: VIEW_TYPE_VF, active: true });
		}
	
		// "Reveal" the leaf in case it is in a collapsed sidebar
		if (leaf) workspace.revealLeaf(leaf);
	}

	VF_OpenTreeView()
	{
		this.activateView();
	}

	VF_RevealActiveFile()
	{
		this.activateView();

		let file = this.app.workspace.getActiveFile();
		if(!file) return;

		let path = this.base.get_next_path(file.path);
		if(path) this.revealFile(path);
	}

	updateUsedTime(file_id:string)
    {
        this.base.note_list[file_id].utime = Date.now();
    }

	VF_AddFolder()
	{
		let file = this.app.workspace.getActiveFile();
		if(!file) return;

		let excludeIds = this.base.get_all_descendants(file.path);
		excludeIds.add(file.path);

		// 1. select file
		new VF_SelectFile(this, (file_id:string) =>
			{
				// 2. add to yaml
				this.yaml.add_link(this.settings.propertyName, file_id);
				this.updateUsedTime(file_id);
				this.update_data();
			},
			excludeIds
		).open();
	}

	VF_MoveFolder()
	{
		let file = this.app.workspace.getActiveFile();
		if(!file) return;

		let excludeIds = this.base.get_all_descendants(file.path);
		excludeIds.add(file.path);

		// 1. select old link
		new VF_SelectPropModal (this, this.settings.propertyName, (old_link:string) =>
			{
				// 2. select new link
				new VF_SelectFile(this, (file_id:string) =>
					{
						// 3. replace link
						this.yaml.replace_link(this.settings.propertyName, old_link, file_id);
						this.updateUsedTime(file_id);
						this.update_data();
					},
					excludeIds
				).open();
			}
		).open();
	}

	VF_RemoveFolder()
	{
		// 1. select old link
		new VF_SelectPropModal (this, this.settings.propertyName, (old_link:string) =>
			{
				// 2. remove it from the list
				this.yaml.remove_link(this.settings.propertyName, old_link);
				this.update_data();
			}
		).open();
	}

	async createNoteInFolder(parentId: string|null, unique: boolean = false)
	{
		if(unique)
		{
			let commands = (this.app as any).commands;
			if(!commands || !commands.executeCommandById)
			{
				this.yaml.showMessage('Commands API is not available');
				return;
			}

			let ref = this.app.vault.on('create', async (file) => {
				if(!(file instanceof TFile)) return;
				this.app.vault.offref(ref);
				if(parentId) await this.app.fileManager.processFrontMatter(file as TFile, (fm) => {
					this.yaml._fm_add_link(fm, parentId, this.settings.propertyName);
				});

				let metaRef = this.app.metadataCache.on('resolve', (resolved) => {
					if(resolved.path !== (file as TFile).path) return;
					this.app.metadataCache.offref(metaRef);
					this.update_data();
					this.VF_RevealActiveFile();
				});
			});

			let executed = commands.executeCommandById('zk-prefixer');
			if(!executed)
			{
				this.app.vault.offref(ref);
				this.yaml.showMessage('Enable "Unique note creator" core plugin');
			}
			return;
		}

		let name = 'Untitled';
		let counter = 0;
		let path = `${name}.md`;

		while(this.app.vault.getAbstractFileByPath(path))
		{
			counter++;
			path = `${name} ${counter}.md`;
		}

		let file = await this.app.vault.create(path, '');

		if(parentId) await this.app.fileManager.processFrontMatter(file, (fm) => {
			this.yaml._fm_add_link(fm, parentId, this.settings.propertyName);
		});

		await this.app.workspace.openLinkText(path, path);

		let metaRef = this.app.metadataCache.on('resolve', (resolved) => {
			if(resolved.path !== path) return;
			this.app.metadataCache.offref(metaRef);
			this.update_data();
			this.VF_RevealActiveFile();
		});
	}

	async deleteNote(noteId: string)
	{
		let file = this.app.vault.getFileByPath(noteId);
		if(!file) return;

		let doDelete = async () => {
			await this.app.vault.trash(file!, true);
			new Notice('Note deleted');
			this.update_data();
		};

		if(this.settings.confirmDelete)
		{
			let note = this.base.note_by_id(noteId);
			let displayName = (note && this.settings.cmdShowTitle) ? note.title : file.basename;
			new VF_ConfirmModal(this.app, displayName, doDelete).open();
		}
		else
		{
			await doDelete();
		}
	}

	moveNoteToFolder(noteId:string, oldParentId:string|null, newParentId:string|null)
	{
		let noteFile = this.app.vault.getFileByPath(noteId);
		if(!noteFile) return;

		this.yaml.move_to_folder(noteFile, this.settings.propertyName, oldParentId, newParentId);

		if(newParentId)
		{
			let note = this.base.note_by_id(newParentId);
			if(note) note.utime = Date.now();
		}

		this.update_data();
	}
}

class VF_ConfirmModal extends Modal
{
	constructor(app: any, private noteName: string, private onConfirm: () => void)
	{
		super(app);
	}

	onOpen()
	{
		this.titleEl.setText('Delete note');
		this.contentEl.createEl('p', {text: `Delete "${this.noteName}"?`});

		new Setting(this.contentEl)
			.addButton((btn) => {
				btn.setButtonText('Delete')
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					});
			})
			.addButton((btn) => {
				btn.setButtonText('Cancel')
					.onClick(() => {
						this.close();
					});
			});
	}
}

