import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { KeyboardButtonComponent } from './keyboard-button.component';

describe('KeyboardButtonComponent', () => {
  let component: KeyboardButtonComponent;
  let fixture: ComponentFixture<KeyboardButtonComponent>;

  beforeEach(async () => {
    // KeyboardButtonComponent is declared in AppModule alongside the child components its
    // template depends on, so importing the module gives the compiler the
    // full context it needs.
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyboardButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
