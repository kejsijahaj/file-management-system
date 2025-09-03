import { Component, inject } from '@angular/core';
import { MatDialogModule } from "@angular/material/dialog";
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss'
})
export class ConfirmDialog {

  data = inject(MAT_DIALOG_DATA) as ConfirmDialogData;
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialog>
  ) {}
}
