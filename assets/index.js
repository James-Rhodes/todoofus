// @ts-check

const todoTemplate = /** @type {HTMLTemplateElement} */ (
  document.getElementById("todo-template")
);
const todoFormTemplate = /** @type {HTMLTemplateElement} */ (
  document.getElementById("todo-form-template")
);
const todoEditFormTemplate = /** @type {HTMLTemplateElement} */ (
  document.getElementById("todo-edit-form-template")
);

const DOUBLE_CLICK_DELAY = 200; // milliseconds

window.addEventListener("load", async () => {
  let todos;
  try {
    const response = await fetch("/todos");
    todos = await response.json();
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const todo_container = document.getElementById("all-todos");
  for (const todo of todos) {
    const todoElement = createTodoTree(
      todo.id,
      todo.description,
      todo.completed,
      todo.children,
    );

    todo_container?.appendChild(todoElement);
  }
  adjustLineHeights();
});

/** Places the form immediately after the refNode
 * @param {HTMLElement} refNode
 */
function newTodoForm(refNode) {
  let parentId = "";
  if (refNode.id != "dummy-first-todo") {
    const parIdElement = refNode.querySelector("input[name='id']");
    if (!(parIdElement instanceof HTMLInputElement)) {
      throw "element was not an input element";
    }
    parentId = parIdElement.value;
  }

  const template = /** @type {DocumentFragment}*/ (
    todoFormTemplate.content.cloneNode(true)
  );
  const parentIdElement = /** @type {HTMLInputElement | null} */ (
    template.querySelector("input[name='parent_id']")
  );
  if (!parentIdElement) {
    throw "no parent id element in template";
  }
  parentIdElement.value = parentId;

  refNode.after(template);
  const descriptionInput = refNode.nextElementSibling?.querySelector(
    "[name='description']",
  );
  if (!(descriptionInput instanceof HTMLInputElement)) {
    throw "no description element";
  }

  descriptionInput.focus(); // Focus for immediate typing
}

/**
 * @param {HTMLElement} formElement
 */
function removeTodoForm(formElement) {
  formElement.remove();
  adjustLineHeights();
}

/**
 * @param {number} id
 * @param {string} todoDescription
 * @param {boolean} todoCompleted
 * @returns {DocumentFragment}
 */
function createTodoElement(id, todoDescription, todoCompleted) {
  const newTodo = /** @type {DocumentFragment} */ (
    todoTemplate?.content.cloneNode(true)
  );

  const description = newTodo.querySelector(".todo-description");
  if (!description) {
    throw "description element not here";
  }
  description.innerHTML = markdownLinksToHtml(todoDescription);

  /** @type {HTMLInputElement | null}*/
  const idInput = newTodo.querySelector("input[name='id']");
  if (!idInput) {
    throw "id input not here";
  }
  idInput.value = id + "";

  /** @type {HTMLInputElement | null}*/
  const checkboxElement = newTodo.querySelector(".todo-checkbox");
  if (!checkboxElement) {
    throw "checkbox element not here";
  }
  checkboxElement.checked = todoCompleted;

  const content = newTodo.querySelector(".todo-contents");
  if (!content) {
    throw "Failed to get todo-contents";
  }

  let clickTimer = null;
  content.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    const clickedTagName = event.target.tagName.toLowerCase();
    if (clickedTagName === "a" || clickedTagName === "input") {
      return; // We want to still allow clicking anchor tags and clicking checkbox
    }

    if (clickTimer != null) {
      // This was a double click
      clearTimeout(clickTimer);
      clickTimer = null;

      console.log("Double Click");
      const closestTodo = event.target.closest(".todo-item");
      if (!closestTodo) {
        throw "Failed to get closest todo";
      }
      const todoParentNode = closestTodo.parentNode;
      if (!(todoParentNode instanceof HTMLElement)) {
        throw "todo parent node was not HTML Element";
      }
      newTodoForm(todoParentNode); // On double click we create a new todo
      return;
    }

    clickTimer = setTimeout(() => {
      // Single click
      clickTimer = null;

      console.log("Single Click");
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      const closestTodoItem = event.target.closest(".todo-item");
      if (!(closestTodoItem instanceof HTMLElement)) {
        throw "no closest item";
      }
      newEditTodoForm(closestTodoItem); // On single click we edit the current todo
    }, DOUBLE_CLICK_DELAY);
  });

  return newTodo;
}

/**
 * @param {number} id
 * @param {string} todoDescription
 * @param {boolean} todoCompleted
 * @param {Array<Object>} childTodos
 *
 * @returns {HTMLElement}
 */
function createTodoTree(id, todoDescription, todoCompleted, childTodos) {
  const todoTreeRoot = document.createElement("ul");

  const listItem = document.createElement("li");
  const newTodo = createTodoElement(id, todoDescription, todoCompleted);
  listItem.appendChild(newTodo);
  todoTreeRoot.appendChild(listItem);

  for (const child of childTodos) {
    todoTreeRoot.appendChild(
      createTodoTree(
        child.id,
        child.description,
        child.completed,
        child.children,
      ),
    );
  }

  return todoTreeRoot;
}

/**
 * @param {Event} event
 */
async function createTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  if (!(submittedForm instanceof HTMLFormElement)) {
    throw "submitted form was not a form element";
  }

  const parentIdElement = submittedForm.querySelector(
    "input[name='parent_id']",
  );
  if (!(parentIdElement instanceof HTMLInputElement)) {
    throw "failed to get parent id";
  }

  /** @type {number|undefined} */
  let parentId = parseInt(parentIdElement.value);
  parentId = isNaN(parentId) ? undefined : parentId; // If the value is empty then set it to undefined

  const descriptionElement = submittedForm.querySelector(
    ".todo-description-input",
  );
  if (!(descriptionElement instanceof HTMLInputElement)) {
    throw "failed to get description input";
  }
  const todoDescription = descriptionElement.value;

  let newTodoId = undefined;
  try {
    const response = await fetch("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: todoDescription,
        parentId: parentId,
      }),
    });

    const json_resp = await response.json();
    newTodoId = json_resp.id;
    console.log("Created new Todo with ID: ", newTodoId);
  } catch (e) {
    console.error("Failed to create Todo item: ", e);
    return;
  }

  const newTodo = createTodoTree(newTodoId, todoDescription, false, []);
  const closestTodoForm = submittedForm.closest(".todo-form");
  if (!(closestTodoForm instanceof HTMLElement)) {
    throw "failed to get closest todo form";
  }
  closestTodoForm.replaceWith(newTodo);

  adjustLineHeights();
}

/**
 * @param {HTMLElement} parentTodo
 * @returns {NodeListOf<HTMLElement>}
 */
function getChildrenTodoItems(parentTodo) {
  const parentUL = parentTodo.parentElement?.parentElement; // The todo item is in a li, which must also be in a ul
  if (!parentUL) {
    throw "parentTodo not inside a UL?";
  }

  return parentUL.querySelectorAll(".todo-item");
}

/**
 * @param {HTMLElement} parentTodo
 */
async function toggleTodoItemRecursively(parentTodo) {
  const todoCheckbox = parentTodo.querySelector(".todo-checkbox");
  if (!(todoCheckbox instanceof HTMLInputElement)) {
    throw "todo checkbox not found";
  }
  const checked = todoCheckbox.checked;
  const childTodos = getChildrenTodoItems(parentTodo);

  const todoToUpdate = [];
  for (const child of childTodos) {
    const idElement = child.querySelector("input[name='id']");
    if (!(idElement instanceof HTMLInputElement)) {
      throw "id element is not input";
    }

    todoToUpdate.push({
      id: parseInt(idElement.value),
      completed: checked,
    });
  }

  try {
    const response = await fetch("/todos/completed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(todoToUpdate),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log("Updated todos with", todoToUpdate);
  } catch (e) {
    console.error("Failed to update Todo items: ", e);
    return;
  }

  for (const child of childTodos) {
    const checkBoxElement = child.querySelector(".todo-checkbox");
    if (!(checkBoxElement instanceof HTMLInputElement)) {
      throw "checkbox element is not input";
    }
    checkBoxElement.checked = checked;
  }
}

/**
 * @param {HTMLElement} todoElement
 */
function newEditTodoForm(todoElement) {
  const editForm = /** @type {DocumentFragment} */ (
    todoEditFormTemplate?.content.cloneNode(true)
  );

  const idElement = todoElement.querySelector("input[name='id']");
  if (!(idElement instanceof HTMLInputElement)) {
    throw "failed to get input id element";
  }
  const todoID = idElement.value;

  const idInput = /** @type {HTMLInputElement | null}  */ (
    editForm.querySelector("input[name='id']")
  );
  if (!idInput) {
    throw "no id input element";
  }
  idInput.value = todoID;

  const todoDescription = htmlLinksToMarkdown(
    todoElement.querySelector(".todo-description")?.innerHTML,
  );
  const descriptionInput = /** @type {HTMLInputElement | null}  */ (
    editForm.querySelector("[name='description']")
  );
  if (!descriptionInput) {
    throw "no description input";
  }
  descriptionInput.value = todoDescription;

  const todoBbox = todoElement.getBoundingClientRect();
  const submitButtons = editForm.querySelector(".todo-edit-buttons");
  if (!submitButtons) {
    throw "no submit buttons found";
  }

  todoElement.replaceWith(editForm);

  // Set the size to match the old space that was taken up
  const buttonBbox = submitButtons.getBoundingClientRect();
  descriptionInput.style.width = todoBbox.width - buttonBbox.width + "px";
  descriptionInput.style.height = todoBbox.height + "px";

  // Focus the description input and move cursor to the end
  descriptionInput.focus();
  if (descriptionInput.setSelectionRange) {
    const length = descriptionInput.value.length;
    descriptionInput.setSelectionRange(length, length);
  }

  // Make the text area submit form on enter key
  const formElement = /** @type {HTMLFormElement} */ (
    descriptionInput.closest(".todo-item")
  );
  if (!formElement) {
    throw "no form element";
  }
  formElement.style.width = todoBbox.width + "";
  formElement.style.height = todoBbox.height + "";
  descriptionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      formElement.requestSubmit();
    }
  });
}

/**
 * @param {Event} event
 */
async function editTodo(event) {
  event.preventDefault();

  const submittedForm = event.target;
  if (!(submittedForm instanceof HTMLFormElement)) {
    throw "form was not a form";
  }

  const descriptionElement = submittedForm.querySelector(
    "[name='description']",
  );
  if (!(descriptionElement instanceof HTMLTextAreaElement)) {
    throw "description was not an input";
  }
  const newDescription = descriptionElement.value;

  const idElement = submittedForm.querySelector("input[name='id']");
  if (!(idElement instanceof HTMLInputElement)) {
    throw "idElement was not input";
  }
  const todoID = parseInt(idElement.value);

  // Send to DB
  let todo_json;
  try {
    const response = await fetch("/todos/description", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID, description: newDescription }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }

    todo_json = await response.json();
    console.log(
      `Updated todo ${todo_json.id} with new description ${todo_json.description}`,
    );
  } catch (e) {
    console.error("Failed to update Todo description: ", e);
    return;
  }

  // Update DOM
  const newTodo = createTodoElement(
    todo_json.id,
    todo_json.description,
    todo_json.completed,
  );

  submittedForm.replaceWith(newTodo);

  adjustLineHeights();
}

/**
 * @param {HTMLElement} todoItem
 */
async function deleteTodo(todoItem) {
  if (!confirm("Are you sure?")) {
    return;
  }

  const idElement = todoItem.querySelector("input[name='id']");
  if (!(idElement instanceof HTMLInputElement)) {
    throw "id element not input element";
  }
  const todoID = parseInt(idElement.value);

  // Send to DB
  try {
    const response = await fetch("/todos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: todoID }),
    });
    if (!response.ok) {
      throw `server responded ${response.status}: ${response.statusText}`;
    }
    console.log(`Deleted todo ${todoID}`);
  } catch (e) {
    console.error("Failed to delete Todo: ", e);
    return;
  }

  // Update DOM
  const treeUL = todoItem.parentElement?.parentElement;
  if (!treeUL) {
    throw "no parent parent element of todo item";
  }

  treeUL.remove();

  adjustLineHeights();
}

function adjustLineHeights() {
  /** @type {NodeListOf<HTMLElement>} */
  const lis = document.querySelectorAll("ul ul li");

  for (const curr of lis) {
    const sibCheckbox =
      curr?.parentElement?.previousElementSibling?.querySelector(
        ".todo-checkbox",
      );
    if (sibCheckbox == null) {
      continue;
    }

    const currRect = curr
      ?.querySelector(".todo-checkbox")
      ?.getBoundingClientRect();

    if (!currRect) {
      continue;
    }
    const currY = currRect.top + currRect.height / 2;
    const currHeight = currRect.height;

    const sibRect = sibCheckbox.getBoundingClientRect();
    const sibY = sibRect.top + sibRect.height / 2;

    const lineHeight = currY - sibY;

    curr.style.setProperty("--line-height", `${lineHeight}px`);
    curr.style.setProperty(
      "--top-shift",
      `-${lineHeight - currHeight + currRect.height / 2 - 3}px`,
    );
  }
}

/**
 * @param {string} text
 * @return {string}
 */
function markdownLinksToHtml(text) {
  return text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

/**
 * @param {string | undefined} html
 * @return {string}
 */
function htmlLinksToMarkdown(html) {
  if (!html) {
    return "";
  }

  return html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)");
}

// TODO: checked nodes sorted to the bottom of the ul they are in, when unchecked move them back into the unchecked section
