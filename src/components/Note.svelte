<script lang="ts">

	// based on `obsidian-dendron-tree-1.3.0`

	export let id = "unknown-link-id";
	export let type = "sub_note"; // or "top_dir" or "orphan_dir"
	export let node_path: string[] = []; // set by parents

	import { getPlugin, data, active_id } from "./stores";
	import { slide } from "svelte/transition";
	import { getIcon, Notice, Menu } from "obsidian";
	import { OneNote } from "onenote";
	import type { Action } from "svelte/action";
	import { tick } from "svelte";
	
    
    let plugin = getPlugin();
	let note: OneNote;

	let title = id;
	let isCollapsed = true;
	let IsOpened = false;

    let childCounter = 0;
	let childList: any[] = [];
	let myElement: HTMLDivElement;
	const children: Record<string, any> = {};

	$:
	{
		IsOpened = (id == $active_id);

		if(type == "top_dir")
		{
			title = 'ROOT';
			childCounter = $data.top_list.length;
			childList = $data.top_list;
		}

		if(type == "orphan_dir")
		{
			title = 'Orphans';
			childCounter = $data.orphans_list.length;
			childList = $data.orphans_list;
		}

		if(type == "sub_note")
		{
			note = $data.note_list[id];

			if (note)
			{
				title = note.title;
				childCounter = note.count_children();
				childList = note.children;
			}
		}
	}

	const collapsedIcon: Action = function (node) {
	    node.appendChild(getIcon("right-triangle")!);
    };

	let expandTransitionWaiter: Promise<void> = Promise.resolve();
	let expandTransitionEnd: (value: void) => void;
	
	function expandTransitionStart() {
		expandTransitionWaiter = new Promise((resolve) => {
			expandTransitionEnd = resolve;
		});
	}

	function build_path(id: string)
	{
		return node_path.concat([id]);
	}

    function openNote(id:string, new_tab:boolean = false)
    {
		if(type == "top_dir" || type == "orphan_dir")
		{
			return;
		}

		// is file exist ?
        plugin.app.workspace.openLinkText(id, id, new_tab);   
    }

	function scrollIntoMiddle()
	{
		//debugger;
		let elementRect = myElement.getBoundingClientRect();
		let absoluteElementTop = elementRect.top + window.scrollY;
		let middle = absoluteElementTop - (window.innerHeight / 2);
		myElement.win.scrollTo(0, middle);
	}

	let isDragOver = false;

	function getDragParentId(): string|null
	{
		let parentId = node_path[node_path.length - 2];
		if(parentId === 'top_dir' || parentId === 'orphan_dir') return null;
		return parentId;
	}

	function handleDragStart(event: DragEvent)
	{
		if(type !== 'sub_note' || !event.dataTransfer) return;
		event.dataTransfer.setData('text/plain', JSON.stringify({
			id: id,
			parentId: getDragParentId()
		}));
		event.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(event: DragEvent)
	{
		event.preventDefault();
		if(event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		isDragOver = true;
	}

	function handleDragLeave()
	{
		isDragOver = false;
	}

	function handleDrop(event: DragEvent)
	{
		event.preventDefault();
		isDragOver = false;
		if(!event.dataTransfer) return;

		let dragData;
		try { dragData = JSON.parse(event.dataTransfer.getData('text/plain')); }
		catch { return; }

		let draggedId: string = dragData.id;
		let oldParentId: string|null = dragData.parentId;

		if(draggedId === id || node_path.includes(draggedId))
		{
			new Notice("Can't move a folder into itself");
			return;
		}

		let newParentId: string|null = null;
		if(type === 'sub_note') newParentId = id;

		if(oldParentId === newParentId) return;

		plugin.moveNoteToFolder(draggedId, oldParentId, newParentId);
	}

	function handleContextMenu(event: MouseEvent)
	{
		if(type !== 'sub_note' && type !== 'top_dir') return;

		event.preventDefault();

		const menu = new Menu();

		let folderId = type === 'top_dir' ? null : id;

		menu.addItem((item) => {
			item.setTitle('Create note')
				.setIcon('plus')
				.onClick(() => {
					plugin.createNoteInFolder(folderId);
				});
		});

		menu.addItem((item) => {
			item.setTitle('Create unique note')
				.setIcon('fingerprint')
				.onClick(() => {
					plugin.createNoteInFolder(folderId, true);
				});
		});

		if(type === 'sub_note')
		{
			menu.addSeparator();

			menu.addItem((item) => {
				item.setTitle('Delete note')
					.setIcon('trash-2')
					.onClick(() => {
						plugin.deleteNote(id);
					});
			});
		}

		menu.showAtMouseEvent(event);
	}

	export const focusNotes = async (pathNotes: string[]) =>
	{
		isCollapsed = false;
		await tick();

		let next:string|undefined = pathNotes.shift();

		if(pathNotes.length === 0) await expandTransitionWaiter;
		
		if(!next)
		{	
			if(myElement)
			{
				//scrollIntoMiddle();
				//  "center" | "end" | "nearest" | "start";
				myElement.scrollIntoView({block: "center"});
			}
			return;
		}

		if(next in children)
		{
			children[next].focusNotes(pathNotes);
		}
	}




</script>


<div class="tree-item is-clickable" bind:this={myElement}>
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="tree-item-self is-clickable mod-collapsible {IsOpened ? 'current_note' : ''}"
		class:vf-drop-target={isDragOver}
		draggable={type === 'sub_note'}
		on:dragstart={handleDragStart}
		on:dragover|preventDefault={handleDragOver}
		on:dragleave={handleDragLeave}
		on:drop={handleDrop}
		on:contextmenu={handleContextMenu}
		on:click={(event) =>
		{
			if(event.shiftKey)
			{
				openNote(id, false);
				return;
			}
			
			if(event.ctrlKey)
			{
				openNote(id, true);
				return;
			}
			
			isCollapsed = false;
			openNote(id);
		}}
	>
        
    {#if childCounter > 0}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div
			class="tree-item-icon collapse-icon"
			class:is-collapsed={isCollapsed}
			on:click|stopPropagation={() => {
				isCollapsed = !isCollapsed;
			}}
            use:collapsedIcon
		/>
    {/if}
    
		<div class="tree-item-inner">
			{title} 
		</div>

    {#if childCounter > 0}
        <span class="counter">
            {childCounter}
        </span>
    {/if}

	</div>

	{#if childCounter > 0 && !isCollapsed}
		<div
			class="tree-item-children"
			transition:slide={{ duration: 100 }}
			on:introstart={expandTransitionStart}
			on:introend={() => {
				// expandTransitionEnd is dyanmic listener
				expandTransitionEnd();
			}}
		>

			{#each childList as child (child)}
				<svelte:self id={child} node_path="{build_path(child)}" bind:this={children[child]} />
			{/each}


		</div>
	{/if}
</div>


<style>
   	.counter {
        text-align: right;
        margin-left: auto;
		background-color: var(--background-secondary-alt);
		position: sticky;
		top: 0;
		color: var(--text-normal);
        padding: 2px 4px;
	}

	.current_note
	{
		background-color: var(--background-secondary-alt);
	}

	.vf-drop-target
	{
		background-color: var(--interactive-accent);
		opacity: 0.85;
		border-radius: 4px;
	}

</style>