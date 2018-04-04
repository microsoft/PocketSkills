/// <reference path="azure.js" />

// This object manages the Skill Practices screen.
function Skills(element, data) {
    'use strict';

    if (!this instanceof Skills)
        return new Skills(element, data);
    var _this = this;

    _this.$root = $('<div>').addClass('skills').appendTo(element); // The root element in the HTML
    _this.data = data; // The user's data and responses to questions
    _this.skills = new Content('SkillPractices');

    _this.$search = $('<input type="text">').addClass('search').attr('placeholder', "Search for Skills").appendTo(_this.$root).on('change keyup', function () {
        var search = $(this).val().toLowerCase();
        if (!search) {
            _this.$skills.find('.skill').show();
        } else {
            _this.$skills.find('.skill').hide();
            _this.$skills.find('.skill').each(function () {
                var skill = _this.skills.get(this.id);
                if (!search || ~skill.Title.toLowerCase().indexOf(search)) {
                    $(this).show(); // Show this row
                    $(this).find('.skill').show(); // Show all the children
                    $(this).parentsUntil(_this.$skills).show(); // Show all the parents
                }
            });
        }
    });

    _this.$skills = $('<div>').addClass('list').appendTo(_this.$root);

    $(_this.skills).on('loaded', function () {
        _this.skills.forEach(function (skill) {
            // Create a new item in the list.
            var $skill = $('<div>').addClass('skill').attr('id', skill.ID).appendTo(_this.$skills).click(function () {
                if (skill.Module && skill.Target) {
                    _this.gotoSkill(skill);
                }
            });
            var $label = $('<div>').addClass('skill-label').appendTo($skill);
            if (skill.Icon) {
                var src = _this.data.evaluateText(skill.Icon);
                if (!src.startsWith('http')) {
                    src = window.server.mediaLocation + src;
                }
                $label.append($('<img>').addClass('skill-icon').attr('src', src));
            }
            var $title = $('<div>').addClass('skill-title').html(skill.Title).appendTo($label);
            if (skill.Points) {
                $title.append($('<div>').append(
                    $('<span class="points">').text(_this.data.evaluateExpression(skill.Points)),
                    $('<span class="pointIcon">')
                ));
            }
            // TODO: Add accumulated?

            var $parent = _this.$skills.find('#' + skill.Parent);
            if (!$parent.length) {
                $parent = _this.$skills;
            }
            $skill.appendTo($parent);
        });
        _this.loaded = new Date();
        $(_this).triggerHandler('loaded');
        _this.update();
    });

    $(_this.data).on('change', function () {
        _this.update();
    });

    // Loads the list of skills from the Content Worksheet via Azure.
    _this.load = function (sas) {
        return _this.skills.load(sas);
    }

    _this.gotoSkill = function (skill) {
        window.location.hash = skill.Module + '/' + skill.Target;
    };

    _this.update = function () {
        _this.$skills.children().each(function () {
            var skill = _this.skills.get(this.id);
            $(this).toggleClass('disabled', skill.AvailableCondition && !_this.data.evaluateExpression(skill.AvailableCondition));
            // TODO: Update points available / accumulated?
        });
    }
}
