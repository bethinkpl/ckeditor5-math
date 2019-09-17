import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ClickObserver from '@ckeditor/ckeditor5-engine/src/view/observer/clickobserver';
import ContextualBalloon from '@ckeditor/ckeditor5-ui/src/panel/balloon/contextualballoon';
import clickOutsideHandler from '@ckeditor/ckeditor5-ui/src/bindings/clickoutsidehandler';

import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import MainFormView from './ui/mainformview';

// Need math commands from there
import MathEditing from './mathediting';
import { defaultConfig } from './utils';

import pluginIcon from '../theme/icons/icon.svg';

const mathKeystroke = 'Ctrl+M';

export default class MathUI extends Plugin {
	static get requires() {
		return [ ContextualBalloon, MathEditing ];
	}

	static get pluginName() {
		return 'MathUI';
	}

	init() {
		const editor = this.editor;
		editor.editing.view.addObserver( ClickObserver );

		this._form = this._createFormView();

		this._balloon = editor.plugins.get( ContextualBalloon );

		this._createToolbarMathButton();

		this._enableUserBalloonInteractions();
	}

	destroy() {
		super.destroy();

		this._form.destroy();
	}

	_showUI() {
		const editor = this.editor;
		const mathCommand = editor.commands.get( 'math' );

		if ( !mathCommand.isEnabled ) {
			return;
		}

		this._addFormView();

		this._balloon.showStack( 'main' );
	}

	_createFormView() {
		const editor = this.editor;
		const mathCommand = editor.commands.get( 'math' );

		const mathConfig = {
			...defaultConfig,
			...this.editor.config.get( 'math' )
		}

		const formView = new MainFormView( editor.locale, mathConfig.engine );

		formView.mathInputView.bind( 'value' ).to( mathCommand, 'value' );
		formView.displayButtonView.bind( 'displayIsOn' ).to( mathCommand, 'display');

		// Listen to submit button click
		this.listenTo( formView, 'submit', () => {
			editor.execute( 'math', formView.equation, formView.displayButtonView.isOn, mathConfig.outputType, mathConfig.forceOutputType );
			this._closeFormView();
		} );

		// Listen to cancel button click
		this.listenTo( formView, 'cancel', () => {
			this._closeFormView();
		} );

		// Close plugin ui, if esc is pressed (while ui is focused)
		formView.keystrokes.set( 'esc', ( data, cancel ) => {
			this._closeFormView();
			cancel();
		} );

		return formView;
	}

	_addFormView() {
		if ( this._isFormInPanel ) {
			return;
		}

		const editor = this.editor;
		const mathCommand = editor.commands.get( 'math' );

		this._balloon.add( {
			view: this._form,
			position: this._getBalloonPositionData(),
		} );

		if ( this._balloon.visibleView === this._form ) {
			this._form.mathInputView.select();
		}

		this._form.equation = mathCommand.value || '';
		this._form.displayButtonView.isOn = mathCommand.display || false;
	}

	_hideUI() {
		if ( !this._isFormInPanel ) {
			return;
		}

		const editor = this.editor;

		this.stopListening( editor.ui, 'update' );
		this.stopListening( this._balloon, 'change:visibleView' );

		editor.editing.view.focus();

		// Remove form first because it's on top of the stack.
		this._removeFormView();
	}
	
	_closeFormView() {
		const mathCommand = this.editor.commands.get( 'math' );
		if ( mathCommand.value !== undefined ) {
			this._removeFormView();
		} else {
			this._hideUI();
		}
	}

	_removeFormView() {
		if ( this._isFormInPanel ) {
			this._form.saveButtonView.focus();

			this._balloon.remove( this._form );

			this.editor.editing.view.focus();
		}
	}

	_getBalloonPositionData() {
		const view = this.editor.editing.view;
		const viewDocument = view.document;
		const target = view.domConverter.viewRangeToDom( viewDocument.selection.getFirstRange() );
		return { target };
	}

	_createToolbarMathButton() {
		const editor = this.editor;
		const mathCommand = editor.commands.get( 'math' );
		const t = editor.t;

		// Handle the `Ctrl+M` keystroke and show the panel.
		editor.keystrokes.set( mathKeystroke, ( keyEvtData, cancel ) => {
			// Prevent focusing the search bar in FF and opening new tab in Edge. #153, #154.
			cancel();

			if ( mathCommand.isEnabled ) {
				this._showUI();
			}
		} );

		this.editor.ui.componentFactory.add( 'math', locale => {
			const button = new ButtonView( locale );

			button.isEnabled = true;
			button.label = t( 'Insert math' );
			button.icon = pluginIcon;
			button.keystroke = mathKeystroke;
			button.tooltip = true;
			button.isToggleable = true;

			button.bind( 'isEnabled' ).to( mathCommand, 'isEnabled' );

			this.listenTo( button, 'execute', () => this._showUI() );

			return button;
		} );
	}

	_enableUserBalloonInteractions() {
		// Close the panel on the Esc key press when the editable has focus and the balloon is visible.
		this.editor.keystrokes.set( 'Esc', ( data, cancel ) => {
			if ( this._isUIVisible ) {
				this._hideUI();
				cancel();
			}
		} );

		// Close on click outside of balloon panel element.
		clickOutsideHandler( {
			emitter: this._form,
			activator: () => this._isFormInPanel,
			contextElements: [ this._balloon.view.element ],
			callback: () => this._hideUI()
		} );
	}

	get _isUIVisible() {
		const visibleView = this._balloon.visibleView;

		return visibleView == this._form;
	}

	get _isFormInPanel() {
		return this._balloon.hasView( this._form );
	}
}
