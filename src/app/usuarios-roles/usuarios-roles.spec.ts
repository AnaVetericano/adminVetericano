import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsuariosRoles } from './usuarios-roles';

describe('UsuariosRoles', () => {
  let component: UsuariosRoles;
  let fixture: ComponentFixture<UsuariosRoles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosRoles],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosRoles);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
