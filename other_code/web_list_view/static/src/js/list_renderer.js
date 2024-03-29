odoo.define('web_list_view.ListRenderer', function (require) {
    "use strict";

    const ListRenderer = require('web.ListRenderer');
    require('web.EditableListRenderer');

    ListRenderer.include({
        async start() {
            await this._super.apply(this, arguments);
            this._renderTheadExtra()
        },
        destroy: function () {
            this.theadExtra.remove();
            return this._super.apply(this, arguments);
        },
        _renderTheadExtra(){
            const fields = this.state.fields;

            const theadExtra = document.createElement("div");
            theadExtra.className = 'o_thead_extra_container'
            this.columns.forEach(column => {
                const fieldName = column['attrs']['name'];
                const field = fields[fieldName];
                if(field && field['string']){
                    const div = document.createElement("div");
                    div.innerText = field['string'];
                    div.setAttribute('name', fieldName)
                    const span = document.createElement('span');
                    div.appendChild(span);
                    theadExtra.appendChild(div);
                }
            });
            document.body.appendChild(theadExtra);
            this.theadExtra = theadExtra;
        },
        _computeDefaultWidths: function () {
            const isListEmpty = !this._hasVisibleRecords(this.state);
            const relativeWidths = [];
            this.columns.forEach(column => {
                const th = this._getColumnHeader(column);
                if (th.offsetParent === null) {
                    relativeWidths.push(false);
                } else {
                    const width = this._getColumnWidth(column);  // 可能的值1、70px
                    if (width.match(/[a-zA-Z]/)) { // absolute width with measure unit (e.g. 100px)
                        if (isListEmpty) {
                            th.style.width = width;
                        } else {
                            // If there are records, we force a min-width for fields with an absolute
                            // width to ensure a correct rendering in edition
                            th.style.minWidth = width;
                        }
                        relativeWidths.push(false);
                    } else { // relative width expressed as a weight (e.g. 1.5)
                        relativeWidths.push(parseFloat(width, 10));
                    }
                }
            });
            // Assignation of relative widths
            if (isListEmpty) {
                const totalWidth = this._getColumnsTotalWidth(relativeWidths);
                for (let i in this.columns) {
                    // if (relativeWidths[i]) {
                        const th = this._getColumnHeader(this.columns[i]);
                        const name = th.dataset.name;
                        if (name) {
                            const el = this.theadExtra.querySelector(`div[name="${name}"]`);
                            if (el) {
                                const width = el.offsetWidth;
                                th.style.width = `${width}px`
                            }
                            else{
                                th.style.width = (relativeWidths[i] / totalWidth * 100) + '%';
                            }
                        }
                        else{
                            th.style.width = (relativeWidths[i] / totalWidth * 100) + '%';
                        }

                    // }
                }
                // Manualy assigns trash icon header width since it's not in the columns
                const trashHeader = this.el.getElementsByClassName('o_list_record_remove_header')[0];
                if (trashHeader) {
                    trashHeader.style.width = '32px';
                }
            }
        },
        _squeezeTable: function () {
            const table = this.el.getElementsByClassName('o_list_table')[0];

            // Toggle a className used to remove style that could interfer with the ideal width
            // computation algorithm (e.g. prevent text fields from being wrapped during the
            // computation, to prevent them from being completely crushed)
            table.classList.add('o_list_computing_widths');

            const thead = table.getElementsByTagName('thead')[0];
            const thElements = [...thead.getElementsByTagName('th')];
            const columnWidths = thElements.map(th => th.offsetWidth);
            const getWidth = th => columnWidths[thElements.indexOf(th)] || 0;
            const getTotalWidth = () => thElements.reduce((tot, th, i) => tot + columnWidths[i], 0);
            const shrinkColumns = (columns, width) => {
                let thresholdReached = false;
                columns.forEach(th => {
                    const index = thElements.indexOf(th);
                    let maxWidth = columnWidths[index] - Math.ceil(width / columns.length);
                    if (maxWidth < 92) { // prevent the columns from shrinking under 92px (~ date field)
                        maxWidth = 92;
                        thresholdReached = true;
                    }
                    // xichunzhang: 不设置最大宽度
                    // th.style.maxWidth = `${maxWidth}px`;
                    columnWidths[index] = maxWidth;
                });
                return thresholdReached;
            };
            // Sort columns, largest first，倒序
            const sortedThs = [...thead.querySelectorAll('th:not(.o_list_button)')].sort((a, b) => getWidth(b) - getWidth(a));
            const allowedWidth = table.parentNode.offsetWidth; // .table-responsive

            let totalWidth = getTotalWidth(); // table_layout:auto下的列宽和
            let stop = false;
            let index = 0;
            while (totalWidth > allowedWidth && !stop) {
                // Find the largest columns
                index++;
                const largests = sortedThs.slice(0, index);  // slice选取数组一部分
                while (getWidth(largests[0]) === getWidth(sortedThs[index])) {
                    largests.push(sortedThs[index]);
                    index++;
                }

                // Compute the number of px to remove from the largest columns
                const nextLargest = sortedThs[index]; // largest column when omitting those in largests
                const totalToRemove = totalWidth - allowedWidth;
                const canRemove = (getWidth(largests[0]) - getWidth(nextLargest)) * largests.length;

                // Shrink the largests columns
                stop = shrinkColumns(largests, Math.min(totalToRemove, canRemove));

                totalWidth = getTotalWidth();
            }

            // We are no longer computing widths, so restore the normal style
            table.classList.remove('o_list_computing_widths');

            this._resetWidth(thElements, columnWidths);

            return columnWidths;
        },
        // o_list_view不设置width
        _onStartResize: function (ev) {
            // Only triggered by left mouse button
            if (ev.which !== 1) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();

            this.isResizing = true;

            const table = this.el.getElementsByClassName('o_list_table')[0];
            const th = ev.target.closest('th');
            table.style.width = `${table.offsetWidth}px`;
            const thPosition = [...th.parentNode.children].indexOf(th);
            const resizingColumnElements = [...table.getElementsByTagName('tr')]
                .filter(tr => tr.children.length === th.parentNode.children.length)
                .map(tr => tr.children[thPosition]);
            const optionalDropdown = this.el.getElementsByClassName('o_optional_columns')[0];
            const initialX = ev.pageX;
            const initialWidth = th.offsetWidth;
            const initialTableWidth = table.offsetWidth;
            const initialDropdownX = optionalDropdown ? optionalDropdown.offsetLeft : null;
            const resizeStoppingEvents = [
                'keydown',
                'mousedown',
                'mouseup',
            ];

            // Fix container width to prevent the table from overflowing when being resized
            if (!this.el.style.width) {
                // this.el.style.width = `${initialTableWidth}px`;
            }

            // Apply classes to table and selected column
            table.classList.add('o_resizing');
            resizingColumnElements.forEach(el => el.classList.add('o_column_resizing'));

            // Mousemove event : resize header
            const resizeHeader = ev => {
                ev.preventDefault();
                ev.stopPropagation();
                const delta = ev.pageX - initialX;
                const newWidth = Math.max(10, initialWidth + delta);
                const tableDelta = newWidth - initialWidth;
                th.style.width = `${newWidth}px`;
                table.style.width = `${initialTableWidth + tableDelta}px`;
                if (optionalDropdown) {
                    optionalDropdown.style.left = `${initialDropdownX + tableDelta}px`;
                }
            };
            this._addEventListener('mousemove', window, resizeHeader);

            // Mouse or keyboard events : stop resize
            const stopResize = ev => {
                // Ignores the initial 'left mouse button down' event in order
                // to not instantly remove the listener
                if (ev.type === 'mousedown' && ev.which === 1) {
                    return;
                }
                ev.preventDefault();
                ev.stopPropagation();
                // We need a small timeout to not trigger a click on column header
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    this.isResizing = false;
                }, 100);
                window.removeEventListener('mousemove', resizeHeader);
                table.classList.remove('o_resizing');
                resizingColumnElements.forEach(el => el.classList.remove('o_column_resizing'));
                resizeStoppingEvents.forEach(stoppingEvent => {
                    window.removeEventListener(stoppingEvent, stopResize);
                });

                // we remove the focus to make sure that the there is no focus inside
                // the tr.  If that is the case, there is some css to darken the whole
                // thead, and it looks quite weird with the small css hover effect.
                document.activeElement.blur();
            };
            // We have to listen to several events to properly stop the resizing function. Those are:
            // - mousedown (e.g. pressing right click)
            // - mouseup : logical flow of the resizing feature (drag & drop)
            // - keydown : (e.g. pressing 'Alt' + 'Tab' or 'Windows' key)
            resizeStoppingEvents.forEach(stoppingEvent => {
                this._addEventListener(stoppingEvent, window, stopResize);
            });
        },

        _resetWidth(thElements, columnWidths) {
            thElements.forEach((th, index) => {
                const name = th.dataset.name;
                if (name) {
                    const el = this.theadExtra.querySelector(`div[name="${name}"]`);
                    if (el) {
                        const width = el.offsetWidth;
                        if(columnWidths[index] < width){
                            columnWidths[index] = width
                        }
                    }
                }
            });
        }


    })

});