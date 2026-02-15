import { TFile } from 'obsidian';
import { BaseScanner } from 'base_scanner';

export class NoteData
{
    constructor(private base: BaseScanner)
    {

    }

    onStartApp()
    {
        this.base.rescan();
    }

    onCreate(file: TFile)
    {
        this.base.add_note(file);
    }

    onChange(file: TFile)
    {
        this.base.update_note(file);
    }

    onRename(file: TFile, oldPath: string)
    {
        this.base.rename_note(file, oldPath);
    }

    onDelete(file: TFile)
    {
        this.base.remove_note(file.path);
    }
}
