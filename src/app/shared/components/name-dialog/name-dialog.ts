import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface NameDialogData {
  name: string;
  label: string;
  title: string;
}

@Component({
  selector: 'app-name-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './name-dialog.html',
  styleUrl: './name-dialog.scss',
})
export class NameDialog {
  data = inject(MAT_DIALOG_DATA) as NameDialogData;
  form = new FormGroup({
    name: new FormControl(this.data.name, [Validators.required, Validators.minLength(1)]),
  });

  constructor(
    public dialogRef: MatDialogRef<NameDialog>
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if(this.form.valid) {
      this.dialogRef.close(this.form.value.name);
    }
  }
}
