import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule} from '@angular/material/button';

export interface ConfirmDeleteFolderData {
    folderName: string;
    files: number;
    subfolders: number;
}

@Component({
    selector: 'app-confirm-delete-folder-dialog',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule],
    template: `<h2 mat-dialog-title>Delete folder?</h2>
    <mat-dialog-content>
      <p><strong>{{data.folderName}}</strong> is not empty.</p>
      <p>It contains
         <strong>{{data.subfolders}}</strong> {{ data.subfolders === 1 ? 'subfolder' : 'subfolders' }}
         and
         <strong>{{data.files}}</strong> {{ data.files === 1 ? 'file' : 'files' }}.
      </p>
      <p>This action permanently deletes everything inside.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close="cancel">Cancel</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="'cascade'">Delete everything</button>
    </mat-dialog-actions>`
})
export class ConfirmDeleteFolderDialog {
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: ConfirmDeleteFolderData
    ) {}
}