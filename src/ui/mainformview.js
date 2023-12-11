import { icons } from 'ckeditor5/src/core';
import {
	ButtonView, FocusCycler, LabelView, LabeledFieldView,
	submitHandler, SwitchButtonView, View, ViewCollection, TextareaView
} from 'ckeditor5/src/ui';
import { FocusTracker, KeystrokeHandler } from 'ckeditor5/src/utils';
import { extractDelimiters, hasDelimiters } from '../utils';
import MathView from './mathview';
import MathLiveView from './mathliveview';

import '../../theme/mathform.css';

const { check: checkIcon, cancel: cancelIcon } = icons;

/*
 * copy from
 * https://github.com/ckeditor/ckeditor5/blob/45e28c6030d590d142dbf319b36d9413a6ad6432/packages/ckeditor5-ui/src/labeledfield/utils.ts#L145
 * but enable resize
 */
const createLabeledTextarea = ( labeledFieldView, viewUid, statusUid ) => {
	const textareaView = new TextareaView( labeledFieldView.locale );
	textareaView.set( {
		id: viewUid,
		ariaDescribedById: statusUid,
		resize: 'both'
	} );
	textareaView.bind( 'isReadOnly' ).to( labeledFieldView, 'isEnabled', value => !value );
	textareaView.bind( 'hasError' ).to( labeledFieldView, 'errorText', value => !!value );
	textareaView.on( 'input', () => {
		// UX: Make the error text disappear and disable the error indicator as the user
		// starts fixing the errors.
		labeledFieldView.errorText = null;
	} );
	labeledFieldView.bind( 'isEmpty', 'isFocused', 'placeholder' ).to( textareaView );
	return textareaView;
};

export default class MainFormView extends View {
	constructor(
		locale,
		engine,
		lazyLoad,
		mathLiveSettings,
		previewEnabled,
		previewUid,
		previewClassName,
		popupClassName,
		katexRenderOptions
	) {
		super( locale );

		const t = locale.t;

		// Create key event & focus trackers
		this._createKeyAndFocusTrackers();

		// Submit button
		this.saveButtonView = this._createButton( t( 'Save' ), checkIcon, 'ck-button-save', null );
		this.saveButtonView.type = 'submit';

		// Equation input
		this.mathInputView = this._createMathInput();

		// Display button
		this.displayButtonView = this._createDisplayButton();

		// Cancel button
		this.cancelButtonView = this._createButton( t( 'Cancel' ), cancelIcon, 'ck-button-cancel', 'cancel' );

		this.mathLiveEnabled = mathLiveSettings.enabled;
		this.previewEnabled = previewEnabled;

		const children = [
			this.mathInputView,
			this.displayButtonView
		];
		if ( this.previewEnabled ) {
			// Preview label
			this.previewLabel = new LabelView( locale );
			this.previewLabel.text = t( 'Equation preview' );

			// Math element
			this.mathView = new MathView( engine, lazyLoad, locale, previewUid, previewClassName, katexRenderOptions );
			this.mathView.bind( 'display' ).to( this.displayButtonView, 'isOn' );

			children.push( this.previewLabel, this.mathView );
		}

		if ( this.mathLiveEnabled ) {
			this.mathLiveView = new MathLiveView( locale, mathLiveSettings );
			this.mathLiveView.on( 'input', event => {
				this.equation = event.source.value;
				this.saveButtonView.isEnabled = !!this.equation;
			} );
			this.mathLiveView.on( 'mathlive:virtualKeyboard:toggle', ( event, state ) => {
				this.fire( 'mathlive:virtualKeyboard:toggle', state );
			} );
			children.unshift( this.mathLiveView );
		}

		// Add UI elements to template
		this.setTemplate( {
			tag: 'form',
			attributes: {
				class: [
					'ck',
					'ck-math-form',
					...popupClassName
				],
				tabindex: '-1',
				spellcheck: 'false'
			},
			children: [
				{
					tag: 'div',
					attributes: {
						class: [
							'ck-math-view'
						]
					},
					children
				},
				this.saveButtonView,
				this.cancelButtonView
			]
		} );
	}

	render() {
		super.render();

		// Prevent default form submit event & trigger custom 'submit'
		submitHandler( {
			view: this
		} );

		// Register form elements to focusable elements
		const childViews = [
			this.mathInputView,
			this.displayButtonView,
			this.saveButtonView,
			this.cancelButtonView
		];

		childViews.forEach( v => {
			this._focusables.add( v );
			this.focusTracker.add( v.element );
		} );

		// Listen to keypresses inside form element
		this.keystrokes.listenTo( this.element );
	}

	focus() {
		this._focusCycler.focusFirst();
	}

	get equation() {
		return this.mathInputView.fieldView.element.value;
	}

	set equation( equation ) {
		this.mathInputView.fieldView.element.value = equation;
		if ( this.previewEnabled ) {
			this.mathView.value = equation;
		}
		if ( this.mathLiveEnabled ) {
			this.mathLiveView.value = equation;
		}
	}

	_createKeyAndFocusTrackers() {
		this.focusTracker = new FocusTracker();
		this.keystrokes = new KeystrokeHandler();
		this._focusables = new ViewCollection();

		this._focusCycler = new FocusCycler( {
			focusables: this._focusables,
			focusTracker: this.focusTracker,
			keystrokeHandler: this.keystrokes,
			actions: {
				focusPrevious: 'shift + tab',
				focusNext: 'tab'
			}
		} );
	}

	_createMathInput() {
		const t = this.locale.t;

		// Create equation input
		const mathInput = new LabeledFieldView( this.locale, createLabeledTextarea );
		const fieldView = mathInput.fieldView;
		mathInput.infoText = t( 'Insert equation in TeX format.' );

		const onInput = () => {
			if ( fieldView.element != null ) {
				let equationInput = fieldView.element.value.trim();

				// If input has delimiters
				if ( hasDelimiters( equationInput ) ) {
					// Get equation without delimiters
					const params = extractDelimiters( equationInput );

					// Remove delimiters from input field
					fieldView.element.value = params.equation;

					equationInput = params.equation;

					// update display button and preview
					this.displayButtonView.isOn = params.display;
				}
				if ( this.previewEnabled ) {
					// Update preview view
					this.mathView.value = equationInput;
				}
				if ( this.mathLiveEnabled ) {
					this.mathLiveView.value = equationInput;
				}

				this.saveButtonView.isEnabled = !!equationInput;
			}
		};

		fieldView.on( 'render', onInput );
		fieldView.on( 'input', onInput );

		return mathInput;
	}

	_createButton( label, icon, className, eventName ) {
		const button = new ButtonView( this.locale );

		button.set( {
			label,
			icon,
			tooltip: true
		} );

		button.extendTemplate( {
			attributes: {
				class: className
			}
		} );

		if ( eventName ) {
			button.delegate( 'execute' ).to( this, eventName );
		}

		return button;
	}

	_createDisplayButton() {
		const t = this.locale.t;

		const switchButton = new SwitchButtonView( this.locale );

		switchButton.set( {
			label: t( 'Display mode' ),
			withText: true
		} );

		switchButton.extendTemplate( {
			attributes: {
				class: 'ck-button-display-toggle'
			}
		} );

		switchButton.on( 'execute', () => {
			// Toggle state
			switchButton.isOn = !switchButton.isOn;

			if ( this.previewEnabled ) {
				// Update preview view
				this.mathView.display = switchButton.isOn;
			}
		} );

		return switchButton;
	}
}
