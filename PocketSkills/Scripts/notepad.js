/// <reference path="azure.js" />

// This object manages the Notepad screen.
function Notepad(element, data) {
    'use strict';

    if (!this instanceof Notepad)
        return new Notepad(element, data);
    var _this = this;

    _this.$root = $('<div>').addClass('notepad').appendTo(element); // The root element in the HTML
    _this.data = data; // The user's data and responses to questions
    _this.notes = {}; // Contains each note in the notepad.

    _this.$search = $('<input type="text">').addClass('search').attr('placeholder', "Search for Notes").appendTo(_this.$root).on('change keyup', function () {
        var search = $(this).val().toLowerCase();
        _this.$notes.children().each(function () {
            var note = _this.notes[this.id];
            if (!search || ~(note.Title || "Untitled Note").toLowerCase().indexOf(search)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });
    _this.$notes = $('<div>').addClass('notes').appendTo(_this.$root);

    // Loads all previous notes into the list.
    _this.load = function (sas, user) {
        _this.table = azure.getTable(sas);
        _this.user = user;

        return _this.table.query(function (rows, error, _, status) {
            if (rows) {
                // Now load the new data.
                rows.reverse().forEach(function (row) {
                    delete row.PartitionKey;
                    delete row.RowKey;
                    delete row.Timestamp;
                    _this.addNote(row);
                });
            } else {
                log("Error loading notes from azure storage:\n" + status + "\n" + (error || {}).responseText);
                throw error;
            }
        }).done(function () {
            _this.loaded = new Date();
            if (Data.logToConsole) {
                console.log("Notepad Loaded on " + _this.loaded);
            }
            $(_this).triggerHandler('loaded');
        });
    }

    // Adds a previously created note to the list of notes in the notepad.
    _this.addNote = function (note) {
        // Remove any previous item in the list for the note.
        $('#' + note.ID + '.note').remove();

        if (!note.Deleted) {
            // Create a new item in the list.
            var $note = $('<div>').addClass('note').attr('id', note.ID).prependTo(_this.$notes).click(function () {
                if (!showingDeletes) {
                    location.hash += '/' + this.id;
                }
            });
            var $selector = $('<label>').addClass('note-selector').appendTo($note);
            var $selectorInput = $('<input type="checkbox">').appendTo($selector).change(function () {
                $note.toggleClass('selected', this.checked);
            });
            var $icon = $('<button>').addClass('note-icon').appendTo($note);
            var $label = $('<div>').addClass('note-label').appendTo($note);
            var $title = $('<div>').addClass('note-title').text(note.Title || "Untitled Note").appendTo($label);
            var $time = $('<div>').addClass('note-time').text(note.Modified).appendTo($label);
        }

        _this.notes[note.ID] = note;

        return $note;
    }

    // Creates a new note, with an optional initial title, and displays it on the screen for editing.
    _this.createNote = function (title) {
        var time = new Date();
        var note = {
            ID: +time,
            Title: title,
            Created: timeString(time),
            Modified: timeString(time)
        };

        _this.notes[note.ID] = note;
        location.hash += '/' + note.ID;
    }

    var showingNote;

    _this.openNote = function (note) {
        if (showingNote != note) {
            if (showingNote) {
                _this.closeNote();
            }
            var $editor = $('<div>').addClass('note-editor').attr('id', note.ID + 'editor').appendTo(_this.$root);
            var $title = $('<input type="text">').addClass('note-title').attr('placeholder', "Untitled Note").val(note.Title).appendTo($editor);
            var $date = $('<div>').addClass('note-date').text(note.Modified).appendTo($editor);
            var $content = $('<textarea>').addClass('note-content').attr('placeholder', "Write your note here...").val(note.Content).appendTo($editor);

            _this.$notes.hide();
            $('#mainFooter').removeClass('showNew showDelete');
            $('#mainFooter').addClass('showSave');
            showingNote = note;
        }
        return showingNote;
    };

    _this.closeNote = function () {
        _this.$notes.show();
        _this.$root.children('.note-editor').remove(); // Close the editor.
        $('#mainFooter').removeClass('showSave');
        $('#mainFooter').addClass('showDelete');
        if (!showingDeletes) {
            $('#mainFooter').addClass('showNew');
        }
        showingNote = null;
    }

    $(element).on('showing', function () {
        $('#mainFooter').addClass('showDelete');
        if (!showingDeletes) {
            $('#mainFooter').addClass('showNew');
        }
    });

    var showingDeletes = false;

    function showDeletes() {
        if (!showingDeletes) {
            _this.$notes.addClass('showDelete');
            $('#mainFooter').removeClass('showNew');
            showingDeletes = true;
        }
    }

    function hideDeletes() {
        if (showingDeletes) {
            $('.note-selector input').prop('checked', false); // Uncheck all the boxes.
            $('.note-selector input').change(); // Let event handlers see that the boxes have been unchecked.
            _this.$notes.removeClass('showDelete'); // Hide the selectors
            $('#mainFooter').addClass('showNew'); // Put the New button back.
            showingDeletes = false;
        }
    }

    function deleteSelected() {
        $('.note.selected').each(function () {
            var $note = $(this);
            var note = _this.notes[this.id];
            note.Deleted = timeString();
            azure.writeData(_this.table, _this.user, note, function done(result, status, response, error) {
                if (error != undefined) {
                    if (confirm("Unable to delete Note " + note.ID + ": " + status + " " + error + ". \nPress OK to retry, or Cancel to ignore.")) {
                        azure.writeData(_this.table, _this.user, note, done);
                    }
                } else {
                    $note.remove();
                }
            });
        });
    }

    $(element).on('delete', function () {
        if (!showingDeletes) {
            showDeletes();
            history.pushState('delete', null, null);
        } else {
            deleteSelected();
            history.back(); // This will remove the UI.
        }
    });

    $(element).on('new', function () {
        _this.createNote();
    });

    $(element).on('save', function () {
        var note = showingNote;
        if (note) {
            note.Modified = timeString();
            showingNote.Title = $('#' + note.ID + 'editor > .note-title').val();
            showingNote.Content = $('#' + note.ID + 'editor > .note-content').val();
            azure.writeData(_this.table, _this.user, note, function done(result, status, response, error) {
                if (error != undefined) {
                    if (confirm("Unable to save Note: " + status + " " + error + ". \nPress OK to retry, or Cancel to ignore.")) {
                        azure.writeData(_this.table, _this.user, note, done);
                    } else {
                        history.back();
                    }
                } else {
                    _this.addNote(note);
                    history.back();
                }
            });
        }
    });

    $(element).on('route', function (ev, path) {
        var note = path.match(/\/?(.*)/)[1];
        if (note && note != 'delete') {
            if (_this.loaded) {
                if (_this.notes[note]) {
                    _this.openNote(_this.notes[note]);
                } else {
                    alert('Unknown note: ' + note);
                    location.hash = location.hash.split('/')[0];
                }
            } else {
                $(_this).one('loaded', route.bind(this, ev, path));
            }
        } else {
            _this.closeNote();
            if (note == 'delete') {
                showDeletes();
            } else {
                hideDeletes();
            }
        }
    });

    function timeString(time) {
        time = time || new Date();
        return time.toLocaleDateString() + " " + time.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric' });
    }
}
