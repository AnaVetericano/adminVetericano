import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditarExamen } from './editar-examen';

describe('EditarExamen', () => {
  let component: EditarExamen;
  let fixture: ComponentFixture<EditarExamen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarExamen],
    }).compileComponents();

    fixture = TestBed.createComponent(EditarExamen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
