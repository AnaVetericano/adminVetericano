import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Editarpato } from './editarpato';

describe('Editarpato', () => {
  let component: Editarpato;
  let fixture: ComponentFixture<Editarpato>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Editarpato],
    }).compileComponents();

    fixture = TestBed.createComponent(Editarpato);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
