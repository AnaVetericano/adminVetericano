import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearUsuarios } from './crear-usuarios';

describe('CrearUsuarios', () => {
  let component: CrearUsuarios;
  let fixture: ComponentFixture<CrearUsuarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearUsuarios],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearUsuarios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
