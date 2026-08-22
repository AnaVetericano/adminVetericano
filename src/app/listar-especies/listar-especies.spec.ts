import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListarEspecies } from './listar-especies';

describe('ListarEspecies', () => {
  let component: ListarEspecies;
  let fixture: ComponentFixture<ListarEspecies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListarEspecies],
    }).compileComponents();

    fixture = TestBed.createComponent(ListarEspecies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
