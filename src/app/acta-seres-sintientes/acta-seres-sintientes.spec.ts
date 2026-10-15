import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { ActaSeresSintientes } from './acta-seres-sintientes';

describe('ActaSeresSintientes', () => {
  let component: ActaSeresSintientes;
  let fixture: ComponentFixture<ActaSeresSintientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActaSeresSintientes],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ActaSeresSintientes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
