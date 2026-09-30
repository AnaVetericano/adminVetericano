import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActaSeresSintientes } from './acta-seres-sintientes';

describe('ActaSeresSintientes', () => {
  let component: ActaSeresSintientes;
  let fixture: ComponentFixture<ActaSeresSintientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActaSeresSintientes],
    }).compileComponents();

    fixture = TestBed.createComponent(ActaSeresSintientes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
